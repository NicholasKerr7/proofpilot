import {
  NotificationEmailStatus,
  type PrismaClient
} from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationEmailSender } from "./notification-email-sender.js";
import {
  deliverNotificationEmailBatch,
  notificationEmailLeaseMs,
  notificationEmailRetryDelaysMs
} from "./notification-email.processor.js";

const now = new Date("2026-07-21T18:00:00.000Z");
const createdAt = new Date("2026-07-21T17:00:00.000Z");
const updatedAt = new Date("2026-07-21T17:30:00.000Z");

function createPrismaMock() {
  const transactionClient = {
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    notification: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (transaction: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient)
    ),
    notification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    transactionClient
  };

  return prisma;
}

function createSenderMock() {
  return {
    send: vi.fn().mockResolvedValue({ providerMessageId: "email-provider-1" })
  };
}

function createNotification(
  overrides: Partial<ReturnType<typeof baseNotification>> = {}
) {
  return {
    ...baseNotification(),
    ...overrides
  };
}

function baseNotification() {
  return {
    id: "notification-1",
    body: "Your case is ready for review.",
    caseId: "case-1",
    createdAt,
    emailAttemptCount: 0,
    emailStatus: NotificationEmailStatus.PENDING,
    title: "Case status updated",
    type: "case_status_updated",
    updatedAt,
    userId: "user-1",
    case: { archivedAt: null as Date | null },
    user: {
      email: "nicholas.kerr@proofpilot.test",
      isPortfolioDemo: false,
      name: "Nicholas Kerr",
      preference: {
        emailNotifications: true,
        notifyCaseUpdates: true,
        notifyDeadlineReminders: true,
        notifyEvidenceProcessing: true,
        notifyPacketReady: true
      }
    }
  };
}

function prepareNotification(
  prisma: ReturnType<typeof createPrismaMock>,
  notification: ReturnType<typeof createNotification>
) {
  prisma.notification.findMany.mockResolvedValue([notification]);
  prisma.notification.findUnique.mockResolvedValue({
    ...notification,
    emailAttemptCount: notification.emailAttemptCount + 1
  });
}

describe("deliverNotificationEmailBatch", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let sender: ReturnType<typeof createSenderMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    sender = createSenderMock();
  });

  it("leases and sends a pending notification exactly once", async () => {
    const notification = createNotification();
    prepareNotification(prisma, notification);

    await expect(
      deliverNotificationEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as NotificationEmailSender
      )
    ).resolves.toEqual({
      claimed: 1,
      contended: 0,
      examined: 1,
      exhausted: 0,
      failed: 0,
      sent: 1,
      suppressed: 0
    });

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        emailStatus: NotificationEmailStatus.PENDING,
        id: notification.id,
        updatedAt
      },
      data: {
        emailAttemptCount: { increment: 1 },
        emailLastAttemptAt: now,
        emailNextAttemptAt: null,
        emailStatus: NotificationEmailStatus.SENDING
      }
    });
    expect(sender.send).toHaveBeenCalledWith({
      body: notification.body,
      notificationId: notification.id,
      recipientName: "Nicholas Kerr",
      title: notification.title,
      to: notification.user.email,
      type: notification.type
    });
    expect(prisma.transactionClient.notification.updateMany).toHaveBeenCalledWith({
      where: {
        emailLastAttemptAt: now,
        emailStatus: NotificationEmailStatus.SENDING,
        id: notification.id
      },
      data: {
        emailLastErrorCode: null,
        emailNextAttemptAt: null,
        emailProviderId: "email-provider-1",
        emailSentAt: now,
        emailStatus: NotificationEmailStatus.SENT
      }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "notification.email_sent",
        caseId: "case-1",
        metadata: {
          notificationId: notification.id,
          notificationType: notification.type,
          providerMessageId: "email-provider-1"
        },
        userId: "user-1"
      }
    });
  });

  it("suppresses a claimed notification when email preferences changed", async () => {
    const notification = createNotification();
    notification.user.preference.emailNotifications = false;
    prepareNotification(prisma, notification);

    await expect(
      deliverNotificationEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as NotificationEmailSender
      )
    ).resolves.toMatchObject({ claimed: 1, sent: 0, suppressed: 1 });

    expect(sender.send).not.toHaveBeenCalled();
    expect(prisma.transactionClient.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          emailLastErrorCode: null,
          emailNextAttemptAt: null,
          emailStatus: NotificationEmailStatus.SUPPRESSED
        }
      })
    );
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "notification.email_suppressed",
          metadata: expect.objectContaining({ reason: "preference_changed" })
        })
      })
    );
  });

  it("never sends notification email from a portfolio demo workspace", async () => {
    const notification = createNotification();
    notification.user.isPortfolioDemo = true;
    prepareNotification(prisma, notification);

    await expect(
      deliverNotificationEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as NotificationEmailSender
      )
    ).resolves.toMatchObject({ claimed: 1, sent: 0, suppressed: 1 });

    expect(sender.send).not.toHaveBeenCalled();
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ reason: "portfolio_demo" })
        })
      })
    );
  });

  it("records sanitized failure diagnostics and schedules a retry", async () => {
    const notification = createNotification();
    prepareNotification(prisma, notification);
    sender.send.mockRejectedValue(
      Object.assign(new Error("private provider response"), { code: "ECONNRESET" })
    );
    const retryAt = new Date(now.getTime() + notificationEmailRetryDelaysMs[0]);

    await expect(
      deliverNotificationEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as NotificationEmailSender
      )
    ).resolves.toMatchObject({ claimed: 1, exhausted: 0, failed: 1, sent: 0 });

    expect(prisma.transactionClient.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          emailLastErrorCode: "ECONNRESET",
          emailNextAttemptAt: retryAt,
          emailStatus: NotificationEmailStatus.FAILED
        }
      })
    );
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "notification.email_delivery_failed",
          metadata: {
            attempt: 1,
            exhausted: false,
            notificationId: notification.id,
            notificationType: notification.type,
            retryAt: retryAt.toISOString()
          }
        })
      })
    );
    expect(JSON.stringify(prisma.transactionClient.auditLog.create.mock.calls)).not.toContain(
      "private provider response"
    );
  });

  it("stops retrying after the fifth delivery attempt", async () => {
    const notification = createNotification({ emailAttemptCount: 4 });
    prepareNotification(prisma, notification);
    sender.send.mockRejectedValue(new Error("provider unavailable"));

    await expect(
      deliverNotificationEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as NotificationEmailSender
      )
    ).resolves.toMatchObject({ exhausted: 1, failed: 1 });

    expect(prisma.transactionClient.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          emailLastErrorCode: "Error",
          emailNextAttemptAt: null,
          emailStatus: NotificationEmailStatus.FAILED
        }
      })
    );
  });

  it("does not send when another worker wins the claim", async () => {
    prisma.notification.findMany.mockResolvedValue([createNotification()]);
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      deliverNotificationEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as NotificationEmailSender
      )
    ).resolves.toMatchObject({ claimed: 0, contended: 1, sent: 0 });

    expect(sender.send).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("includes expired delivery leases in the candidate query", async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await deliverNotificationEmailBatch(
      prisma as unknown as PrismaClient,
      now,
      sender as unknown as NotificationEmailSender
    );

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              emailLastAttemptAt: {
                lte: new Date(now.getTime() - notificationEmailLeaseMs)
              },
              emailStatus: NotificationEmailStatus.SENDING
            }
          ])
        })
      })
    );
  });
});
