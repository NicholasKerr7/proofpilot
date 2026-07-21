import type { Job } from "bullmq";
import {
  CaseStatus,
  DocumentStatus,
  getPrismaClient,
  PacketStatus
} from "@proofpilot/database";
import { readStoredObjectChunks, writeStoredObjectBytes } from "@proofpilot/storage";
import { randomUUID } from "node:crypto";
import type { GeneratePacketJobData } from "../queues/packet-generation.queue.js";
import {
  generateCasePacketPdf,
  type PacketPdfDocument,
  type PacketSupportingContentKind
} from "./case-packet-pdf.js";

const prisma = getPrismaClient();

interface PacketFailureContext {
  caseId: string;
  createNotification: boolean;
  packetId: string;
  ownerId: string;
  platform: string;
  title: string;
}

interface PacketEvidenceRecord {
  originalName: string;
  mimeType: string;
  byteSize: number;
  status: DocumentStatus;
  createdAt: Date;
  extractedText: string | null;
  quarantinedAt: Date | null;
  storageKey: string;
}

const maxEmbeddedDocumentCount = 12;
const maxEmbeddedDocumentBytes = 12 * 1024 * 1024;
const maxEmbeddedTotalBytes = 40 * 1024 * 1024;

class EvidenceReadLimitError extends Error {}

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
                name: true,
                preference: {
                  select: {
                    inAppNotifications: true,
                    notifyPacketReady: true
                  }
                }
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
                createdAt: true,
                extractedText: true,
                quarantinedAt: true,
                storageKey: true
              }
            },
            events: {
              orderBy: [{ sortOrder: "asc" }, { occurredAt: "asc" }, { id: "asc" }],
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
      createNotification:
        packet.case.owner.preference?.inAppNotifications !== false &&
        packet.case.owner.preference?.notifyPacketReady !== false,
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

    const documents = await loadSupportingEvidence(packet.case.documents);
    const pdf = await generateCasePacketPdf({
      ...packet.case,
      documents
    });
    const storageKey = createPacketStorageKey(packet.case.ownerId, packet.case.id);

    await writeStoredObjectBytes({
      body: pdf.bytes,
      contentType: "application/pdf",
      key: storageKey
    });

    await prisma.$transaction([
      prisma.packetExport.create({
        data: {
          byteSize: pdf.bytes.byteLength,
          includedDocumentCount: pdf.includedDocumentCount,
          indexedDocumentCount: pdf.indexedDocumentCount,
          packetId: packet.id,
          pageCount: pdf.pageCount,
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
            byteSize: pdf.bytes.byteLength,
            includedDocumentCount: pdf.includedDocumentCount,
            indexedDocumentCount: pdf.indexedDocumentCount,
            pageCount: pdf.pageCount,
            packetId: packet.id
          }
        }
      }),
      ...(failureContext.createNotification
        ? [
            prisma.notification.create({
              data: {
                userId: packet.case.ownerId,
                caseId: packet.case.id,
                type: "packet_ready",
                title: "Packet ready",
                body: `${packet.case.platform} packet for ${packet.case.title} is ready to download.`
              }
            })
          ]
        : [])
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
        ...(failureContext.createNotification
          ? [
              prisma.notification.create({
                data: {
                  userId: failureContext.ownerId,
                  caseId: failureContext.caseId,
                  type: "packet_failed",
                  title: "Packet generation failed",
                  body: `${failureContext.platform} packet for ${failureContext.title} could not be generated. ${truncateMessage(message)}`
                }
              })
            ]
          : [])
      ]);
    }

    throw error;
  }
}

async function loadSupportingEvidence(
  documents: PacketEvidenceRecord[]
): Promise<PacketPdfDocument[]> {
  const packetDocuments: PacketPdfDocument[] = [];
  let embeddedDocumentCount = 0;
  let embeddedByteCount = 0;

  for (const document of documents) {
    const packetDocument: PacketPdfDocument = {
      originalName: document.originalName,
      mimeType: document.mimeType,
      byteSize: document.byteSize,
      status: document.status,
      createdAt: document.createdAt,
      extractedText: null,
      supportingContent: null,
      supportingNote: null
    };
    const canIncludeProcessedContent =
      !document.quarantinedAt &&
      (document.status === DocumentStatus.PROCESSED ||
        document.status === DocumentStatus.NEEDS_REVIEW);

    if (!canIncludeProcessedContent) {
      packetDocuments.push({
        ...packetDocument,
        supportingNote: document.quarantinedAt
          ? "Original content was excluded because this file is quarantined."
          : `Original content was excluded while the document status is ${formatStatus(document.status)}.`
      });
      continue;
    }

    const kind = getSupportingContentKind(document.mimeType);
    packetDocument.extractedText = document.extractedText;

    if (!kind) {
      packetDocuments.push({
        ...packetDocument,
        supportingNote:
          "This file format is represented by extracted text when available; the original remains indexed."
      });
      continue;
    }

    const skipReason = getEvidenceReadSkipReason({
      byteSize: document.byteSize,
      embeddedByteCount,
      embeddedDocumentCount
    });

    if (skipReason) {
      packetDocuments.push({
        ...packetDocument,
        supportingNote: skipReason
      });
      continue;
    }

    try {
      const maximumReadBytes = Math.min(
        maxEmbeddedDocumentBytes,
        maxEmbeddedTotalBytes - embeddedByteCount
      );
      const bytes = await readEvidenceBytes(document.storageKey, maximumReadBytes);

      embeddedDocumentCount += 1;
      embeddedByteCount += bytes.byteLength;
      packetDocuments.push({
        ...packetDocument,
        supportingContent: {
          bytes: new Uint8Array(bytes),
          kind
        }
      });
    } catch (error) {
      packetDocuments.push({
        ...packetDocument,
        supportingNote:
          error instanceof EvidenceReadLimitError
            ? "The original file exceeded the remaining packet evidence limit while being read."
            : "The original file could not be read from storage; extracted text is included when available."
      });
    }
  }

  return packetDocuments;
}

async function readEvidenceBytes(storageKey: string, maximumBytes: number) {
  const { chunks } = await readStoredObjectChunks({ key: storageKey });
  const buffers: Buffer[] = [];
  let byteCount = 0;

  for await (const chunk of chunks) {
    byteCount += chunk.byteLength;

    if (byteCount > maximumBytes) {
      throw new EvidenceReadLimitError("Stored evidence exceeded its packet read limit.");
    }

    buffers.push(Buffer.from(chunk));
  }

  return Buffer.concat(buffers, byteCount);
}

function getSupportingContentKind(mimeType: string): PacketSupportingContentKind | null {
  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType === "application/pdf") {
    return "pdf";
  }

  if (normalizedMimeType === "image/png") {
    return "png";
  }

  if (normalizedMimeType === "image/jpeg" || normalizedMimeType === "image/jpg") {
    return "jpeg";
  }

  return null;
}

function getEvidenceReadSkipReason(input: {
  byteSize: number;
  embeddedByteCount: number;
  embeddedDocumentCount: number;
}) {
  if (input.embeddedDocumentCount >= maxEmbeddedDocumentCount) {
    return `The original file was not appended because the ${maxEmbeddedDocumentCount}-file packet limit was reached.`;
  }

  if (input.byteSize > maxEmbeddedDocumentBytes) {
    return `The original file exceeds the ${formatBytes(maxEmbeddedDocumentBytes)} per-file packet limit.`;
  }

  if (input.embeddedByteCount + input.byteSize > maxEmbeddedTotalBytes) {
    return `The original file was not appended because the ${formatBytes(maxEmbeddedTotalBytes)} packet evidence limit would be exceeded.`;
  }

  return null;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBytes(value: number) {
  return `${Math.round(value / (1024 * 1024))} MB`;
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
