import {
  getPrismaClient,
  PacketShareEmailStatus,
  type PrismaClient
} from "@proofpilot/database";
import type { PacketSharePermission } from "@proofpilot/types";
import { createPacketShareRecipientToken } from "@proofpilot/types/packet-share-security";
import type { Job } from "bullmq";
import { getWorkerEnv } from "../config/env.js";
import type { DeliverPacketShareEmailsJobData } from "../queues/packet-share-email.queue.js";
import {
  createPacketShareInvitationEmailSender,
  type PacketShareInvitationEmailSender
} from "./packet-share-email-sender.js";

export const packetShareEmailLeaseMs = 10 * 60 * 1_000;
export const packetShareEmailMaxAttempts = 5;
export const packetShareEmailRetryDelaysMs = [
  5 * 60 * 1_000,
  15 * 60 * 1_000,
  60 * 60 * 1_000,
  6 * 60 * 60 * 1_000
] as const;
const packetShareEmailBatchSize = 50;

export interface PacketShareEmailDeliveryResult {
  claimed: number;
  contended: number;
  examined: number;
  exhausted: number;
  failed: number;
  sent: number;
  suppressed: number;
}

let defaultSender: PacketShareInvitationEmailSender | null = null;

export async function deliverPacketShareEmails(
  _job: Job<DeliverPacketShareEmailsJobData>
) {
  const env = getWorkerEnv();
  defaultSender ??= createPacketShareInvitationEmailSender(env);
  return deliverPacketShareEmailBatch(
    getPrismaClient(),
    new Date(),
    defaultSender,
    env.JWT_SECRET,
    env.WEB_ORIGIN
  );
}

export async function deliverPacketShareEmailBatch(
  client: PrismaClient,
  now: Date,
  sender: PacketShareInvitationEmailSender,
  signingSecret: string,
  webOrigin: string
): Promise<PacketShareEmailDeliveryResult> {
  const leaseCutoff = new Date(now.getTime() - packetShareEmailLeaseMs);
  const deliveries = await client.packetShareEmailDelivery.findMany({
    where: {
      OR: [
        {
          status: PacketShareEmailStatus.PENDING,
          nextAttemptAt: { lte: now }
        },
        {
          status: PacketShareEmailStatus.FAILED,
          nextAttemptAt: { lte: now }
        },
        {
          status: PacketShareEmailStatus.SENDING,
          lastAttemptAt: { lte: leaseCutoff }
        }
      ]
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      updatedAt: true
    },
    take: packetShareEmailBatchSize
  });
  const result: PacketShareEmailDeliveryResult = {
    claimed: 0,
    contended: 0,
    examined: deliveries.length,
    exhausted: 0,
    failed: 0,
    sent: 0,
    suppressed: 0
  };

  for (const delivery of deliveries) {
    const claim = await client.packetShareEmailDelivery.updateMany({
      where: {
        id: delivery.id,
        status: delivery.status,
        updatedAt: delivery.updatedAt
      },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        nextAttemptAt: null,
        status: PacketShareEmailStatus.SENDING
      }
    });

    if (!claim.count) {
      result.contended += 1;
      continue;
    }

    result.claimed += 1;
    const current = await client.packetShareEmailDelivery.findUnique({
      where: { id: delivery.id },
      select: {
        attemptCount: true,
        id: true,
        recipient: {
          select: {
            email: true,
            id: true,
            permission: true
          }
        },
        share: {
          select: {
            caseId: true,
            createdBy: {
              select: { email: true, name: true }
            },
            createdById: true,
            expiresAt: true,
            id: true,
            packetExport: {
              select: {
                packet: {
                  select: {
                    case: { select: { title: true } }
                  }
                }
              }
            },
            requireEmailVerification: true,
            revokedAt: true
          }
        }
      }
    });

    if (!current) {
      result.contended += 1;
      continue;
    }

    const suppressionReason = getSuppressionReason(current.share, now);

    if (suppressionReason) {
      const suppressed = await updateDeliveryState(client, current, now, {
        action: "case.packet_share_email_suppressed",
        data: {
          lastErrorCode: null,
          nextAttemptAt: null,
          status: PacketShareEmailStatus.SUPPRESSED
        },
        metadata: {
          deliveryId: current.id,
          reason: suppressionReason,
          recipientId: current.recipient.id,
          shareId: current.share.id
        }
      });

      if (suppressed) {
        result.suppressed += 1;
      } else {
        result.contended += 1;
      }
      continue;
    }

    const recipientToken = createPacketShareRecipientToken(
      {
        recipientId: current.recipient.id,
        shareId: current.share.id
      },
      signingSecret
    );
    const shareUrl = `${webOrigin.replace(/\/$/, "")}/shared-packet#${recipientToken}`;

    try {
      const sentEmail = await sender.send({
        caseTitle: current.share.packetExport.packet.case.title,
        deliveryId: current.id,
        expiresAt: current.share.expiresAt,
        ownerName:
          current.share.createdBy.name?.trim() || current.share.createdBy.email,
        permission: current.recipient.permission as PacketSharePermission,
        recipientId: current.recipient.id,
        requireEmailVerification: current.share.requireEmailVerification,
        shareId: current.share.id,
        shareUrl,
        to: current.recipient.email
      });
      const sent = await updateDeliveryState(client, current, now, {
        action: "case.packet_share_email_sent",
        data: {
          lastErrorCode: null,
          nextAttemptAt: null,
          providerMessageId: sentEmail.providerMessageId,
          sentAt: now,
          status: PacketShareEmailStatus.SENT
        },
        metadata: {
          deliveryId: current.id,
          recipientId: current.recipient.id,
          shareId: current.share.id,
          ...(sentEmail.providerMessageId
            ? { providerMessageId: sentEmail.providerMessageId }
            : {})
        }
      });

      if (sent) {
        result.sent += 1;
      } else {
        result.contended += 1;
      }
    } catch (error) {
      const attempt = current.attemptCount;
      const exhausted = attempt >= packetShareEmailMaxAttempts;
      const retryDelay =
        packetShareEmailRetryDelaysMs[
          Math.min(attempt - 1, packetShareEmailRetryDelaysMs.length - 1)
        ] ?? 6 * 60 * 60 * 1_000;
      const retryAt = exhausted ? null : new Date(now.getTime() + retryDelay);
      const failed = await updateDeliveryState(client, current, now, {
        action: "case.packet_share_email_delivery_failed",
        data: {
          lastErrorCode: getErrorCode(error),
          nextAttemptAt: retryAt,
          status: PacketShareEmailStatus.FAILED
        },
        metadata: {
          attempt,
          deliveryId: current.id,
          exhausted,
          recipientId: current.recipient.id,
          shareId: current.share.id,
          ...(retryAt ? { retryAt: retryAt.toISOString() } : {})
        }
      });

      if (failed) {
        result.failed += 1;
        result.exhausted += Number(exhausted);
      } else {
        result.contended += 1;
      }
    }
  }

  return result;
}

function getSuppressionReason(
  share: { expiresAt: Date | null; revokedAt: Date | null },
  now: Date
) {
  if (share.revokedAt) {
    return "share_revoked";
  }

  if (share.expiresAt && share.expiresAt <= now) {
    return "share_expired";
  }

  return null;
}

async function updateDeliveryState(
  client: PrismaClient,
  delivery: {
    id: string;
    recipient: { id: string };
    share: { caseId: string; createdById: string; id: string };
  },
  attemptedAt: Date,
  input: {
    action: string;
    data: {
      lastErrorCode: string | null;
      nextAttemptAt: Date | null;
      providerMessageId?: string | null;
      sentAt?: Date;
      status: PacketShareEmailStatus;
    };
    metadata: Record<string, boolean | number | string>;
  }
) {
  return client.$transaction(async (transaction) => {
    const update = await transaction.packetShareEmailDelivery.updateMany({
      where: {
        id: delivery.id,
        lastAttemptAt: attemptedAt,
        status: PacketShareEmailStatus.SENDING
      },
      data: input.data
    });

    if (!update.count) {
      return false;
    }

    await transaction.auditLog.create({
      data: {
        action: input.action,
        caseId: delivery.share.caseId,
        metadata: input.metadata,
        userId: delivery.share.createdById
      }
    });

    return true;
  });
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
