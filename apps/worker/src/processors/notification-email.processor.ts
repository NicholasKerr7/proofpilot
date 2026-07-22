import {
  getPrismaClient,
  NotificationEmailStatus,
  type PrismaClient
} from "@proofpilot/database";
import type { Job } from "bullmq";
import type { DeliverNotificationEmailsJobData } from "../queues/notification-email.queue.js";
import {
  createNotificationEmailSender,
  type NotificationEmailSender
} from "./notification-email-sender.js";

export const notificationEmailLeaseMs = 10 * 60 * 1_000;
export const notificationEmailMaxAttempts = 5;
export const notificationEmailRetryDelaysMs = [
  5 * 60 * 1_000,
  15 * 60 * 1_000,
  60 * 60 * 1_000,
  6 * 60 * 60 * 1_000
] as const;
const notificationEmailBatchSize = 50;

export interface NotificationEmailDeliveryResult {
  claimed: number;
  contended: number;
  examined: number;
  exhausted: number;
  failed: number;
  sent: number;
  suppressed: number;
}

let defaultSender: NotificationEmailSender | null = null;

export async function deliverNotificationEmails(
  _job: Job<DeliverNotificationEmailsJobData>
) {
  defaultSender ??= createNotificationEmailSender();
  return deliverNotificationEmailBatch(getPrismaClient(), new Date(), defaultSender);
}

export async function deliverNotificationEmailBatch(
  client: PrismaClient,
  now: Date,
  sender: NotificationEmailSender
): Promise<NotificationEmailDeliveryResult> {
  const leaseCutoff = new Date(now.getTime() - notificationEmailLeaseMs);
  const notifications = await client.notification.findMany({
    where: {
      OR: [
        {
          emailStatus: NotificationEmailStatus.PENDING,
          emailNextAttemptAt: { lte: now }
        },
        {
          emailStatus: NotificationEmailStatus.FAILED,
          emailNextAttemptAt: { lte: now }
        },
        {
          emailStatus: NotificationEmailStatus.SENDING,
          emailLastAttemptAt: { lte: leaseCutoff }
        }
      ]
    },
    orderBy: [{ emailNextAttemptAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      emailStatus: true,
      updatedAt: true
    },
    take: notificationEmailBatchSize
  });
  const result: NotificationEmailDeliveryResult = {
    claimed: 0,
    contended: 0,
    examined: notifications.length,
    exhausted: 0,
    failed: 0,
    sent: 0,
    suppressed: 0
  };

  for (const notification of notifications) {
    const claim = await client.notification.updateMany({
      where: {
        emailStatus: notification.emailStatus,
        id: notification.id,
        updatedAt: notification.updatedAt
      },
      data: {
        emailAttemptCount: { increment: 1 },
        emailLastAttemptAt: now,
        emailNextAttemptAt: null,
        emailStatus: NotificationEmailStatus.SENDING
      }
    });

    if (!claim.count) {
      result.contended += 1;
      continue;
    }

    result.claimed += 1;
    const currentNotification = await client.notification.findUnique({
      where: { id: notification.id },
      select: {
        id: true,
        body: true,
        caseId: true,
        emailAttemptCount: true,
        title: true,
        type: true,
        userId: true,
        case: {
          select: { archivedAt: true }
        },
        user: {
          select: {
            email: true,
            name: true,
            preference: {
              select: {
                emailNotifications: true,
                notifyCaseUpdates: true,
                notifyDeadlineReminders: true,
                notifyEvidenceProcessing: true,
                notifyPacketReady: true
              }
            }
          }
        }
      }
    });

    if (!currentNotification) {
      result.contended += 1;
      continue;
    }

    const suppressionReason = getSuppressionReason(currentNotification);

    if (suppressionReason) {
      const suppressed = await updateDeliveryState(client, currentNotification, now, {
        action: "notification.email_suppressed",
        notificationData: {
          emailLastErrorCode: null,
          emailNextAttemptAt: null,
          emailStatus: NotificationEmailStatus.SUPPRESSED
        },
        metadata: {
          notificationId: currentNotification.id,
          notificationType: currentNotification.type,
          reason: suppressionReason
        }
      });

      if (suppressed) {
        result.suppressed += 1;
      } else {
        result.contended += 1;
      }
      continue;
    }

    try {
      const delivery = await sender.send({
        body: currentNotification.body,
        notificationId: currentNotification.id,
        recipientName: currentNotification.user.name?.trim() || "there",
        title: currentNotification.title,
        to: currentNotification.user.email,
        type: currentNotification.type
      });
      const sent = await updateDeliveryState(client, currentNotification, now, {
        action: "notification.email_sent",
        notificationData: {
          emailLastErrorCode: null,
          emailNextAttemptAt: null,
          emailProviderId: delivery.providerMessageId,
          emailSentAt: now,
          emailStatus: NotificationEmailStatus.SENT
        },
        metadata: {
          notificationId: currentNotification.id,
          notificationType: currentNotification.type,
          ...(delivery.providerMessageId
            ? { providerMessageId: delivery.providerMessageId }
            : {})
        }
      });

      if (sent) {
        result.sent += 1;
      } else {
        result.contended += 1;
      }
    } catch (error) {
      const attempt = currentNotification.emailAttemptCount;
      const exhausted = attempt >= notificationEmailMaxAttempts;
      const retryDelay =
        notificationEmailRetryDelaysMs[
          Math.min(attempt - 1, notificationEmailRetryDelaysMs.length - 1)
        ] ?? 6 * 60 * 60 * 1_000;
      const retryAt = exhausted
        ? null
        : new Date(now.getTime() + retryDelay);
      const failed = await updateDeliveryState(client, currentNotification, now, {
        action: "notification.email_delivery_failed",
        notificationData: {
          emailLastErrorCode: getErrorCode(error),
          emailNextAttemptAt: retryAt,
          emailStatus: NotificationEmailStatus.FAILED
        },
        metadata: {
          attempt,
          exhausted,
          notificationId: currentNotification.id,
          notificationType: currentNotification.type,
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

function getSuppressionReason(notification: {
  case: { archivedAt: Date | null } | null;
  type: string;
  user: {
    preference: {
      emailNotifications: boolean;
      notifyCaseUpdates: boolean;
      notifyDeadlineReminders: boolean;
      notifyEvidenceProcessing: boolean;
      notifyPacketReady: boolean;
    } | null;
  };
}) {
  if (notification.case?.archivedAt) {
    return "case_archived";
  }

  const preference = notification.user.preference;

  if (preference?.emailNotifications === false) {
    return "preference_changed";
  }

  const categoryEnabled = getCategoryPreference(notification.type, preference);
  return categoryEnabled ? null : "preference_changed";
}

function getCategoryPreference(
  type: string,
  preference: {
    notifyCaseUpdates: boolean;
    notifyDeadlineReminders: boolean;
    notifyEvidenceProcessing: boolean;
    notifyPacketReady: boolean;
  } | null
) {
  switch (type) {
    case "case_status_updated":
      return preference?.notifyCaseUpdates !== false;
    case "deadline_reminder":
      return preference?.notifyDeadlineReminders !== false;
    case "processing_completed":
    case "processing_failed":
      return preference?.notifyEvidenceProcessing !== false;
    case "packet_failed":
    case "packet_ready":
      return preference?.notifyPacketReady !== false;
    default:
      return false;
  }
}

async function updateDeliveryState(
  client: PrismaClient,
  notification: { caseId: string | null; id: string; type: string; userId: string },
  attemptedAt: Date,
  input: {
    action: string;
    metadata: Record<string, boolean | number | string>;
    notificationData: {
      emailLastErrorCode?: string | null;
      emailNextAttemptAt: Date | null;
      emailProviderId?: string | null;
      emailSentAt?: Date;
      emailStatus: NotificationEmailStatus;
    };
  }
) {
  return client.$transaction(async (transaction) => {
    const update = await transaction.notification.updateMany({
      where: {
        emailLastAttemptAt: attemptedAt,
        emailStatus: NotificationEmailStatus.SENDING,
        id: notification.id
      },
      data: input.notificationData
    });

    if (!update.count) {
      return false;
    }

    await transaction.auditLog.create({
      data: {
        action: input.action,
        caseId: notification.caseId,
        metadata: input.metadata,
        userId: notification.userId
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
  const sanitizedCode = code.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80);

  return sanitizedCode || "UnknownError";
}
