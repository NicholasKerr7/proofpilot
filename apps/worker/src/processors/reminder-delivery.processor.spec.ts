import type { PrismaClient } from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deliverDueReminderBatch } from "./reminder-delivery.processor.js";

const now = new Date("2026-07-20T14:00:00.000Z");

function createPrismaMock() {
  const transactionClient = {
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    notification: {
      create: vi.fn().mockResolvedValue({})
    },
    reminder: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
  const prisma = {
    reminder: {
      findMany: vi.fn()
    },
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    transactionClient
  };

  return prisma;
}

function createDueReminder(
  preference: {
    inAppNotifications: boolean;
    notifyDeadlineReminders: boolean;
  } | null = {
    inAppNotifications: true,
    notifyDeadlineReminders: true
  }
) {
  return {
    id: "reminder-1",
    message: "Review missing evidence before the deadline.",
    remindAt: new Date("2026-07-20T13:00:00.000Z"),
    case: {
      id: "case-1",
      ownerId: "owner-1",
      title: "PayPal appeal",
      owner: { preference }
    }
  };
}

describe("deliverDueReminderBatch", () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it("atomically claims and delivers due reminders for active cases", async () => {
    prisma.reminder.findMany.mockResolvedValue([createDueReminder()]);

    await expect(
      deliverDueReminderBatch(prisma as unknown as PrismaClient, now)
    ).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      examined: 1,
      suppressed: 0
    });

    expect(prisma.reminder.findMany).toHaveBeenCalledWith({
      where: {
        completedAt: null,
        remindAt: { lte: now },
        sentAt: null,
        case: { archivedAt: null }
      },
      orderBy: [{ remindAt: "asc" }, { id: "asc" }],
      select: expect.any(Object),
      take: 100
    });
    expect(prisma.transactionClient.reminder.updateMany).toHaveBeenCalledWith({
      where: {
        completedAt: null,
        id: "reminder-1",
        sentAt: null
      },
      data: { sentAt: now }
    });
    expect(prisma.transactionClient.notification.create).toHaveBeenCalledWith({
      data: {
        body: "Review missing evidence before the deadline.",
        caseId: "case-1",
        title: "Reminder: PayPal appeal",
        type: "deadline_reminder",
        userId: "owner-1"
      }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "case.reminder_sent",
        caseId: "case-1",
        metadata: {
          delivery: "in_app",
          reminderId: "reminder-1",
          remindAt: "2026-07-20T13:00:00.000Z"
        },
        userId: "owner-1"
      }
    });
  });

  it("claims a due reminder without creating an alert when preferences suppress it", async () => {
    prisma.reminder.findMany.mockResolvedValue([
      createDueReminder({
        inAppNotifications: true,
        notifyDeadlineReminders: false
      })
    ]);

    await expect(
      deliverDueReminderBatch(prisma as unknown as PrismaClient, now)
    ).resolves.toEqual({
      claimed: 1,
      delivered: 0,
      examined: 1,
      suppressed: 1
    });

    expect(prisma.transactionClient.notification.create).not.toHaveBeenCalled();
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ delivery: "suppressed" })
        })
      })
    );
  });

  it("does not duplicate a notification when another worker already claimed the reminder", async () => {
    prisma.reminder.findMany.mockResolvedValue([createDueReminder(null)]);
    prisma.transactionClient.reminder.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      deliverDueReminderBatch(prisma as unknown as PrismaClient, now)
    ).resolves.toEqual({
      claimed: 0,
      delivered: 0,
      examined: 1,
      suppressed: 0
    });

    expect(prisma.transactionClient.notification.create).not.toHaveBeenCalled();
    expect(prisma.transactionClient.auditLog.create).not.toHaveBeenCalled();
  });
});
