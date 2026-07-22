import type { PrismaClient } from "@proofpilot/database";
import { getPrismaClient } from "@proofpilot/database";
import { buildNotificationDelivery } from "@proofpilot/types";
import type { Job } from "bullmq";
import type { DeliverRemindersJobData } from "../queues/reminder-delivery.queue.js";

const reminderDeliveryBatchSize = 100;

export interface ReminderDeliveryResult {
  claimed: number;
  delivered: number;
  examined: number;
  suppressed: number;
}

export async function deliverDueReminders(_job: Job<DeliverRemindersJobData>) {
  return deliverDueReminderBatch(getPrismaClient());
}

export async function deliverDueReminderBatch(
  client: PrismaClient,
  now = new Date()
): Promise<ReminderDeliveryResult> {
  const dueReminders = await client.reminder.findMany({
    where: {
      completedAt: null,
      remindAt: { lte: now },
      sentAt: null,
      case: {
        archivedAt: null
      }
    },
    orderBy: [{ remindAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      message: true,
      remindAt: true,
      case: {
        select: {
          id: true,
          ownerId: true,
          title: true,
          owner: {
            select: {
              preference: {
                select: {
                  emailNotifications: true,
                  inAppNotifications: true,
                  notifyDeadlineReminders: true
                }
              }
            }
          }
        }
      }
    },
    take: reminderDeliveryBatchSize
  });

  const result: ReminderDeliveryResult = {
    claimed: 0,
    delivered: 0,
    examined: dueReminders.length,
    suppressed: 0
  };

  for (const reminder of dueReminders) {
    const outcome = await client.$transaction(async (tx) => {
      const claimed = await tx.reminder.updateMany({
        where: {
          completedAt: null,
          id: reminder.id,
          sentAt: null
        },
        data: { sentAt: now }
      });

      if (!claimed.count) {
        return "contended" as const;
      }

      const preference = reminder.case.owner.preference;
      const notificationDelivery = buildNotificationDelivery({
        event: {
          body: reminder.message,
          caseId: reminder.case.id,
          title: `Reminder: ${reminder.case.title}`,
          type: "deadline_reminder",
          userId: reminder.case.ownerId
        },
        now,
        preference: preference
          ? {
              categoryEnabled: preference.notifyDeadlineReminders,
              emailNotifications: preference.emailNotifications,
              inAppNotifications: preference.inAppNotifications
            }
          : null
      });

      if (notificationDelivery) {
        await tx.notification.create({
          data: notificationDelivery.data
        });
      }

      await tx.auditLog.create({
        data: {
          action: "case.reminder_sent",
          caseId: reminder.case.id,
          metadata: {
            delivery: notificationDelivery?.channels.join(",") ?? "suppressed",
            reminderId: reminder.id,
            remindAt: reminder.remindAt.toISOString()
          },
          userId: reminder.case.ownerId
        }
      });

      return notificationDelivery ? ("delivered" as const) : ("suppressed" as const);
    });

    if (outcome === "contended") {
      continue;
    }

    result.claimed += 1;
    result[outcome] += 1;
  }

  return result;
}
