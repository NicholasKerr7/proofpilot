import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsService } from "./notifications.service.js";

const ownerId = "owner-1";
const reminderId = "reminder-1";
const caseId = "case-1";

function createPrismaMock() {
  const transactionClient = {
    reminder: {
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    notification: {
      create: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    }
  };
  const prisma = {
    case: {
      findFirst: vi.fn()
    },
    notification: {
      findMany: vi.fn().mockResolvedValue([])
    },
    reminder: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    transactionClient
  };

  return prisma;
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createReminderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: reminderId,
    caseId,
    remindAt: new Date("2026-07-20T14:00:00.000Z"),
    message: "Review the appeal packet.",
    sentAt: null,
    completedAt: null,
    createdAt: new Date("2026-07-11T14:00:00.000Z"),
    ...overrides
  };
}

describe("NotificationsService", () => {
  let prisma: PrismaMock;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it("lists reminders only through active cases owned by the current user", async () => {
    prisma.reminder.findMany.mockResolvedValue([]);

    await expect(service.listReminders(ownerId)).resolves.toEqual([]);
    expect(prisma.reminder.findMany).toHaveBeenCalledWith({
      where: {
        case: {
          ownerId,
          archivedAt: null
        }
      },
      orderBy: { remindAt: "asc" },
      select: expect.objectContaining({
        completedAt: true,
        case: {
          select: {
            id: true,
            platform: true,
            title: true
          }
        }
      }),
      take: 100
    });
  });

  it("rejects invalid reminder creation values at the service boundary", async () => {
    prisma.case.findFirst.mockResolvedValue({
      id: caseId,
      deadline: null,
      platform: "PayPal",
      title: "PayPal appeal"
    });

    await expect(
      service.createCaseReminder(ownerId, caseId, {
        remindAt: "2020-01-01T00:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createCaseReminder(ownerId, caseId, {
        remindAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: "   "
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reschedules and re-arms an owned reminder", async () => {
    const remindAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const updatedRow = createReminderRow({
      remindAt: new Date(remindAt),
      message: "Review the updated appeal packet."
    });
    prisma.reminder.findFirst.mockResolvedValue({ id: reminderId, caseId });
    prisma.transactionClient.reminder.update.mockResolvedValue(updatedRow);

    const result = await service.updateReminder(ownerId, reminderId, {
      remindAt,
      message: "  Review the updated appeal packet.  "
    });

    expect(prisma.reminder.findFirst).toHaveBeenCalledWith({
      where: {
        id: reminderId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true
      }
    });
    expect(prisma.transactionClient.reminder.update).toHaveBeenCalledWith({
      where: { id: reminderId },
      data: {
        remindAt: new Date(remindAt),
        sentAt: null,
        completedAt: null,
        message: "Review the updated appeal packet."
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.reminder_updated",
        metadata: {
          reminderId,
          remindAt,
          messageUpdated: true
        }
      }
    });
    expect(result).toEqual(updatedRow);
  });

  it("marks an owned reminder complete without exposing message content in the audit log", async () => {
    const updatedRow = createReminderRow({ completedAt: new Date() });
    prisma.reminder.findFirst.mockResolvedValue({ id: reminderId, caseId });
    prisma.transactionClient.reminder.update.mockResolvedValue(updatedRow);

    await service.updateReminder(ownerId, reminderId, { completed: true });

    expect(prisma.transactionClient.reminder.update).toHaveBeenCalledWith({
      where: { id: reminderId },
      data: { completedAt: expect.any(Date) },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.reminder_updated",
        metadata: {
          reminderId,
          completed: true
        }
      }
    });
  });

  it("rejects invalid updates before querying reminder ownership", async () => {
    await expect(service.updateReminder(ownerId, reminderId, {})).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      service.updateReminder(ownerId, reminderId, { message: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateReminder(ownerId, reminderId, { remindAt: "2020-01-01T00:00:00.000Z" })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.reminder.findFirst).not.toHaveBeenCalled();
  });

  it("does not update a reminder outside the current owner scope", async () => {
    prisma.reminder.findFirst.mockResolvedValue(null);

    await expect(
      service.updateReminder(ownerId, "reminder-other", { completed: true })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lists owned notifications without mutating reminder delivery state", async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await expect(service.list(ownerId)).resolves.toEqual([]);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: ownerId },
      orderBy: { createdAt: "desc" },
      select: expect.any(Object),
      take: 50
    });
    expect(prisma.reminder.findMany).not.toHaveBeenCalled();
    expect(prisma.transactionClient.reminder.updateMany).not.toHaveBeenCalled();
  });
});
