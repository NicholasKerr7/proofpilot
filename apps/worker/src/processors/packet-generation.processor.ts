import type { Job } from "bullmq";
import { CaseStatus, getPrismaClient, PacketStatus } from "@proofpilot/database";
import { writeStoredObjectBytes } from "@proofpilot/storage";
import { randomUUID } from "node:crypto";
import type { GeneratePacketJobData } from "../queues/packet-generation.queue.js";
import { generateCasePacketPdf } from "./case-packet-pdf.js";

const prisma = getPrismaClient();

interface PacketFailureContext {
  caseId: string;
  packetId: string;
  ownerId: string;
  platform: string;
  title: string;
}

export async function generateCasePacket(job: Job<GeneratePacketJobData>) {
  let failureContext: PacketFailureContext | null = null;

  try {
    const packet = await prisma.casePacket.findFirst({
      where: {
        id: job.data.packetId,
        caseId: job.data.caseId,
        case: {
          archivedAt: null,
          ownerId: job.data.ownerId
        }
      },
      select: {
        id: true,
        status: true,
        exports: {
          orderBy: { createdAt: "desc" },
          select: { id: true },
          take: 1
        },
        case: {
          select: {
            id: true,
            ownerId: true,
            title: true,
            platform: true,
            summary: true,
            deadline: true,
            createdAt: true,
            updatedAt: true,
            owner: {
              select: {
                email: true,
                name: true
              }
            },
            caseType: {
              select: {
                name: true
              }
            },
            checklist: {
              orderBy: { createdAt: "asc" },
              select: {
                label: true,
                description: true,
                status: true,
                matches: {
                  orderBy: { confidence: "desc" },
                  take: 3,
                  select: {
                    confidence: true,
                    rationale: true,
                    document: {
                      select: {
                        originalName: true
                      }
                    }
                  }
                }
              }
            },
            documents: {
              orderBy: { createdAt: "asc" },
              select: {
                originalName: true,
                mimeType: true,
                byteSize: true,
                status: true,
                createdAt: true
              }
            },
            events: {
              orderBy: { occurredAt: "asc" },
              select: {
                occurredAt: true,
                title: true,
                description: true,
                confidence: true,
                sources: {
                  select: {
                    document: {
                      select: {
                        originalName: true
                      }
                    }
                  }
                }
              }
            },
            statements: {
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: {
                content: true,
                updatedAt: true
              }
            }
          }
        }
      }
    });

    if (!packet) {
      throw new Error(`Packet ${job.data.packetId} was not found.`);
    }

    failureContext = {
      caseId: packet.case.id,
      ownerId: packet.case.ownerId,
      packetId: packet.id,
      platform: packet.case.platform,
      title: packet.case.title
    };

    if (packet.status === PacketStatus.READY && packet.exports.length > 0) {
      return {
        packetId: packet.id,
        status: PacketStatus.READY
      };
    }

    await prisma.casePacket.update({
      where: { id: packet.id },
      data: { status: PacketStatus.GENERATING }
    });

    const pdfBytes = await generateCasePacketPdf(packet.case);
    const storageKey = createPacketStorageKey(packet.case.ownerId, packet.case.id);

    await writeStoredObjectBytes({
      body: pdfBytes,
      contentType: "application/pdf",
      key: storageKey
    });

    await prisma.$transaction([
      prisma.packetExport.create({
        data: {
          byteSize: pdfBytes.byteLength,
          packetId: packet.id,
          storageKey
        }
      }),
      prisma.casePacket.update({
        where: { id: packet.id },
        data: { status: PacketStatus.READY }
      }),
      prisma.case.update({
        where: { id: packet.case.id },
        data: { status: CaseStatus.PACKET_GENERATED }
      }),
      prisma.auditLog.create({
        data: {
          userId: packet.case.ownerId,
          caseId: packet.case.id,
          action: "case.packet_generated",
          metadata: {
            byteSize: pdfBytes.byteLength,
            packetId: packet.id
          }
        }
      }),
      prisma.notification.create({
        data: {
          userId: packet.case.ownerId,
          caseId: packet.case.id,
          type: "packet_ready",
          title: "Packet ready",
          body: `${packet.case.platform} packet for ${packet.case.title} is ready to download.`
        }
      })
    ]);

    return {
      packetId: packet.id,
      status: PacketStatus.READY
    };
  } catch (error) {
    if (failureContext && !willRetry(job)) {
      const message = error instanceof Error ? error.message : "Packet generation failed.";

      await prisma.$transaction([
        prisma.casePacket.update({
          where: { id: failureContext.packetId },
          data: { status: PacketStatus.FAILED }
        }),
        prisma.auditLog.create({
          data: {
            userId: failureContext.ownerId,
            caseId: failureContext.caseId,
            action: "case.packet_generation_failed",
            metadata: {
              message,
              packetId: failureContext.packetId
            }
          }
        }),
        prisma.notification.create({
          data: {
            userId: failureContext.ownerId,
            caseId: failureContext.caseId,
            type: "packet_failed",
            title: "Packet generation failed",
            body: `${failureContext.platform} packet for ${failureContext.title} could not be generated. ${truncateMessage(message)}`
          }
        })
      ]);
    }

    throw error;
  }
}

function createPacketStorageKey(ownerId: string, caseId: string) {
  return `users/${ownerId}/cases/${caseId}/packets/${randomUUID()}.pdf`;
}

function truncateMessage(message: string) {
  if (message.length <= 160) {
    return message;
  }

  return `${message.slice(0, 157)}...`;
}

function willRetry(job: Job<GeneratePacketJobData>) {
  const attempts =
    typeof job.opts.attempts === "number" && job.opts.attempts > 0 ? job.opts.attempts : 1;
  return job.attemptsMade + 1 < attempts;
}
