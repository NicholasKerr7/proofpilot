import {
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { PacketStatus } from "@proofpilot/database";
import { createPresignedDownloadUrl } from "@proofpilot/storage";
import { buildCaseAccessWhere, createCaseAccess } from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { PacketGenerationQueueService } from "../queue/packet-generation-queue.service.js";
import type { CaseAccessGuard } from "./case-access.guard.js";
import { packetSelect, type PacketRecord } from "./case-selects.js";

/** Owns packet generation state, queue submission, and signed export access. */
export class CasePacketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: PacketGenerationQueueService,
    private readonly access: CaseAccessGuard
  ) {}

  /** Lists packet attempts and short-lived export URLs for permitted collaborators. */
  async list(userId: string, caseId: string) {
    const caseAccess = await this.access.require(userId, caseId, "READ");

    if (!createCaseAccess(userId, caseAccess).canDownload) {
      throw new NotFoundException("Packet exports are not available for this collaborator.");
    }

    const packets = await this.prisma.casePacket.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: packetSelect
    });

    return Promise.all(packets.map((packet) => toPublicPacket(packet)));
  }

  /** Creates one active packet attempt and submits it to the generation queue. */
  async generate(userId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "EDIT"),
        archivedAt: null
      },
      select: {
        id: true,
        ownerId: true
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const existingPacket = await this.prisma.casePacket.findFirst({
      where: {
        caseId: foundCase.id,
        status: PacketStatus.GENERATING
      },
      orderBy: { createdAt: "desc" },
      select: packetSelect
    });

    if (existingPacket) {
      return toPublicPacket(existingPacket);
    }

    const packet = await this.prisma.casePacket.create({
      data: {
        caseId: foundCase.id,
        status: PacketStatus.GENERATING
      },
      select: packetSelect
    });

    let jobId: string | null = null;

    try {
      const job = await this.queue.addGeneratePacketJob({
        caseId: foundCase.id,
        ownerId: foundCase.ownerId,
        packetId: packet.id
      });
      jobId = job.id ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Packet generation could not be queued.";

      // A durable failed state prevents the UI from polling a job that never existed.
      await this.prisma.$transaction([
        this.prisma.casePacket.update({
          where: { id: packet.id },
          data: { status: PacketStatus.FAILED }
        }),
        this.prisma.auditLog.create({
          data: {
            userId,
            caseId: foundCase.id,
            action: "case.packet_generation_queue_failed",
            metadata: {
              message,
              packetId: packet.id
            }
          }
        })
      ]);

      throw new ServiceUnavailableException("Packet generation could not be queued. Try again shortly.");
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        caseId: foundCase.id,
        action: "case.packet_generation_queued",
        metadata: {
          jobId,
          packetId: packet.id
        }
      }
    });

    return toPublicPacket(packet);
  }
}

/** Removes storage keys and replaces them with short-lived download and preview URLs. */
async function toPublicPacket(packet: PacketRecord) {
  return {
    id: packet.id,
    caseId: packet.caseId,
    status: packet.status,
    createdAt: packet.createdAt,
    updatedAt: packet.updatedAt,
    exports: await Promise.all(
      packet.exports.map(async (packetExport) => {
        const [downloadUrl, previewUrl] = await Promise.all([
          createPresignedDownloadUrl({
            disposition: "attachment",
            expiresInSeconds: 900,
            fileName: "proofpilot-case-packet.pdf",
            key: packetExport.storageKey
          }),
          createPresignedDownloadUrl({
            disposition: "inline",
            expiresInSeconds: 900,
            fileName: "proofpilot-case-packet.pdf",
            key: packetExport.storageKey
          })
        ]);

        return {
          id: packetExport.id,
          byteSize: packetExport.byteSize,
          pageCount: packetExport.pageCount,
          includedDocumentCount: packetExport.includedDocumentCount,
          indexedDocumentCount: packetExport.indexedDocumentCount,
          createdAt: packetExport.createdAt,
          downloadUrl,
          previewUrl
        };
      })
    )
  };
}
