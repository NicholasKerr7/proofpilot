import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import {
  CaseCollaboratorStatus,
  PacketSharePermission as DatabasePacketSharePermission,
  PacketStatus
} from "@proofpilot/database";
import { createPresignedDownloadUrl } from "@proofpilot/storage";
import type {
  PacketShareCapabilities,
  PacketShareCreatedResponse,
  PacketShareEmailDeliverySummary,
  PacketSharePacketSummary,
  PacketSharePermission,
  PacketSharePreparationResponse,
  PacketShareRevokedResponse
} from "@proofpilot/types";
import { getApiEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PacketShareEmailQueueService } from "../queue/packet-share-email-queue.service.js";
import type { CreatePacketShareDto } from "./dto/create-packet-share.dto.js";
import { PacketShareMailerService } from "./packet-share-mailer.service.js";

const maximumShareLifetimeMs = 365 * 24 * 60 * 60 * 1_000;
const minimumShareLifetimeMs = 5 * 60 * 1_000;

@Injectable()
export class PacketSharingService {
  private readonly logger = new Logger(PacketSharingService.name);
  private readonly webOrigin = getApiEnv().WEB_ORIGIN.replace(/\/$/, "");

  constructor(
    private readonly prisma: PrismaService,
    private readonly packetShareMailer: PacketShareMailerService,
    private readonly packetShareEmailQueue: PacketShareEmailQueueService
  ) {}

  async prepare(
    ownerId: string,
    caseId: string
  ): Promise<PacketSharePreparationResponse> {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        archivedAt: null,
        id: caseId,
        ownerId
      },
      select: {
        title: true,
        collaborators: {
          where: { status: CaseCollaboratorStatus.ACTIVE },
          orderBy: { name: "asc" },
          select: {
            email: true,
            name: true
          }
        },
        packets: {
          where: { status: PacketStatus.READY },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            exports: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                byteSize: true,
                createdAt: true
              }
            }
          }
        },
        packetShares: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            _count: { select: { recipients: true } }
          }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const packet = foundCase.packets[0];
    const packetExport = packet?.exports[0];

    return {
      activeShares: foundCase.packetShares.map((share) => ({
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString() ?? null,
        id: share.id,
        recipientCount: share._count.recipients
      })),
      capabilities: this.getCapabilities(),
      packet:
        packet && packetExport
          ? {
              byteSize: packetExport.byteSize,
              createdAt: packetExport.createdAt.toISOString(),
              exportId: packetExport.id,
              packetId: packet.id,
              title: foundCase.title
            }
          : null,
      suggestedRecipients: foundCase.collaborators
    };
  }

  async revoke(
    ownerId: string,
    caseId: string,
    shareId: string
  ): Promise<PacketShareRevokedResponse> {
    const share = await this.prisma.packetShare.findFirst({
      where: {
        id: shareId,
        caseId,
        revokedAt: null,
        case: {
          archivedAt: null,
          ownerId
        }
      },
      select: { id: true }
    });

    if (!share) {
      throw new NotFoundException("Active packet share not found.");
    }

    const revokedAt = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.packetShare.update({
        where: { id: share.id },
        data: { revokedAt }
      });
      await transaction.auditLog.create({
        data: {
          action: "case.packet_share_revoked",
          caseId,
          userId: ownerId,
          metadata: { shareId: share.id }
        }
      });
    });

    return {
      id: share.id,
      revokedAt: revokedAt.toISOString()
    };
  }

  async create(
    ownerId: string,
    caseId: string,
    input: CreatePacketShareDto
  ): Promise<PacketShareCreatedResponse> {
    this.assertSupportedSecurityOptions(input);
    const expiresAt = this.parseExpiration(input.expiresAt);
    const recipients = this.normalizeRecipients(input.recipients);
    const packetExport = await this.prisma.packetExport.findFirst({
      where: {
        id: input.packetExportId,
        packet: {
          status: PacketStatus.READY,
          case: {
            archivedAt: null,
            id: caseId,
            ownerId
          }
        }
      },
      select: {
        id: true,
        byteSize: true,
        createdAt: true,
        storageKey: true,
        packet: {
          select: {
            id: true,
            case: {
              select: {
                owner: { select: { email: true, name: true } },
                title: true
              }
            }
          }
        }
      }
    });

    if (!packetExport) {
      throw new NotFoundException("Ready packet export not found.");
    }

    const ownerEmail = packetExport.packet.case.owner.email.trim().toLowerCase();

    if (recipients.some((recipient) => recipient.email === ownerEmail)) {
      throw new BadRequestException(
        "The case owner does not need a recipient share link."
      );
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const queuedAt = new Date();
    const share = await this.prisma.$transaction(async (transaction) => {
      const createdShare = await transaction.packetShare.create({
        data: {
          caseId,
          createdById: ownerId,
          expiresAt,
          packetExportId: packetExport.id,
          requireEmailVerification: input.requireEmailVerification,
          tokenHash,
          watermarkDocuments: false,
          recipients: {
            create: recipients
          }
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          requireEmailVerification: true,
          watermarkDocuments: true,
          recipients: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              email: true,
              permission: true,
              lastAccessedAt: true
            }
          }
        }
      });

      await transaction.packetShareEmailDelivery.createMany({
        data: createdShare.recipients.map((recipient) => ({
          nextAttemptAt: queuedAt,
          recipientId: recipient.id,
          shareId: createdShare.id
        }))
      });
      await transaction.auditLog.create({
        data: {
          action: "case.packet_share_created",
          caseId,
          userId: ownerId,
          metadata: {
            emailDeliveryQueuedCount: createdShare.recipients.length,
            expiresAt: expiresAt?.toISOString() ?? null,
            packetExportId: packetExport.id,
            permissions: [
              ...new Set(recipients.map((recipient) => recipient.permission))
            ],
            recipientCount: recipients.length,
            requireEmailVerification: input.requireEmailVerification,
            shareId: createdShare.id
          }
        }
      });

      return createdShare;
    });

    try {
      await this.packetShareEmailQueue.triggerDelivery();
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          errorCode: getErrorCode(error),
          event: "packet_share_email_queue_trigger_failed",
          shareId: share.id
        })
      );
    }

    const ownerDownloadUrl = await createPresignedDownloadUrl({
      disposition: "attachment",
      expiresInSeconds: 900,
      fileName: toPacketFileName(packetExport.packet.case.title),
      key: packetExport.storageKey
    });
    const shareUrl = `${this.webOrigin}/shared-packet#${rawToken}`;
    const emailDelivery: PacketShareEmailDeliverySummary = {
      attemptedCount: 0,
      failedCount: 0,
      queuedCount: share.recipients.length,
      successfulCount: 0
    };

    return {
      capabilities: this.getCapabilities(),
      createdAt: share.createdAt.toISOString(),
      deliveryMode: this.packetShareMailer.deliveryMode,
      emailDelivery,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      id: share.id,
      ownerDownloadUrl,
      packet: this.toPacketSummary(packetExport, packetExport.packet.case.title),
      recipients: share.recipients.map((recipient) => ({
        email: recipient.email,
        id: recipient.id,
        lastAccessedAt: recipient.lastAccessedAt?.toISOString() ?? null,
        permission: recipient.permission as PacketSharePermission
      })),
      requireEmailVerification: share.requireEmailVerification,
      shareUrl,
      watermarkDocuments: share.watermarkDocuments
    };
  }

  private getCapabilities(): PacketShareCapabilities {
    return {
      comments: true,
      emailDelivery: true,
      emailDeliveryMode: this.packetShareMailer.deliveryMode,
      emailVerification: true,
      watermarking: false
    };
  }

  private assertSupportedSecurityOptions(input: CreatePacketShareDto) {
    if (input.watermarkDocuments) {
      throw new BadRequestException(
        "Packet watermarking requires a configured watermark processor."
      );
    }
  }

  private normalizeRecipients(recipients: CreatePacketShareDto["recipients"]) {
    const normalized = recipients.map((recipient) => ({
      email: recipient.email.trim().toLowerCase(),
      permission: recipient.permission as DatabasePacketSharePermission
    }));
    const uniqueEmails = new Set(
      normalized.map((recipient) => recipient.email)
    );

    if (uniqueEmails.size !== normalized.length) {
      throw new BadRequestException(
        "Each packet recipient must have a unique email address."
      );
    }

    return normalized;
  }

  private parseExpiration(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const expiresAt = new Date(value);
    const lifetimeMs = expiresAt.getTime() - Date.now();

    if (!Number.isFinite(expiresAt.getTime()) || lifetimeMs < minimumShareLifetimeMs) {
      throw new BadRequestException(
        "Packet share expiration must be at least five minutes away."
      );
    }

    if (lifetimeMs > maximumShareLifetimeMs) {
      throw new BadRequestException(
        "Packet share expiration cannot exceed one year."
      );
    }

    return expiresAt;
  }

  private toPacketSummary(
    packetExport: {
      byteSize: number | null;
      createdAt: Date;
      id: string;
      packet: { id: string };
    },
    title: string
  ): PacketSharePacketSummary {
    return {
      byteSize: packetExport.byteSize,
      createdAt: packetExport.createdAt.toISOString(),
      exportId: packetExport.id,
      packetId: packetExport.packet.id,
      title
    };
  }
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getErrorCode(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : error instanceof Error
        ? error.name
        : "UnknownError";
  return code.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80) || "UnknownError";
}

function toPacketFileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${slug || "proofpilot-case"}-packet.pdf`;
}
