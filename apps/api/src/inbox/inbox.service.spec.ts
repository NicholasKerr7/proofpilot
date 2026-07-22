import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { InboxService } from "./inbox.service.js";

const userId = "user-1";
const caseId = "case-1";
const supportRequestId = "support-1";
const notificationId = "notification-1";

function createPrismaMock() {
  const prisma = {
    supportRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    notification: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    )
  };

  return prisma;
}

function createCaseRow() {
  return {
    deadline: new Date("2026-08-04T12:00:00.000Z"),
    id: caseId,
    platform: "PayPal",
    status: "NEEDS_MORE_EVIDENCE",
    title: "PayPal account closure appeal"
  };
}

function createSupportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: supportRequestId,
    category: "CASE_ASSISTANCE",
    subject: "Account closure appeal",
    message: "Please review the evidence attached to my appeal.",
    priority: "NORMAL",
    status: "IN_PROGRESS",
    readAt: null,
    createdAt: new Date("2026-07-20T12:00:00.000Z"),
    updatedAt: new Date("2026-07-22T14:00:00.000Z"),
    case: createCaseRow(),
    messages: [
      {
        author: "SUPPORT",
        message: "We reviewed the additional evidence.",
        createdAt: new Date("2026-07-22T14:00:00.000Z")
      }
    ],
    ...overrides
  };
}

function createNotificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: notificationId,
    type: "inbox_team_message",
    title: "Additional documentation needed",
    body: "Please upload a copy of your government-issued ID.",
    readAt: new Date("2026-07-22T13:00:00.000Z"),
    createdAt: new Date("2026-07-22T13:00:00.000Z"),
    case: createCaseRow(),
    ...overrides
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe("InboxService", () => {
  let prisma: PrismaMock;
  let service: InboxService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new InboxService(prisma as unknown as PrismaService);
  });

  it("projects owned support threads and notifications without duplicate receipts", async () => {
    prisma.supportRequest.findMany.mockResolvedValue([createSupportRow()]);
    prisma.notification.findMany.mockResolvedValue([createNotificationRow()]);

    const conversations = await service.list(userId);

    expect(conversations).toHaveLength(2);
    expect(conversations[0]).toMatchObject({
      id: supportRequestId,
      category: "SUPPORT",
      participantName: "ProofPilot Support",
      preview: "We reviewed the additional evidence.",
      source: "SUPPORT_REQUEST"
    });
    expect(conversations[1]).toMatchObject({
      id: notificationId,
      category: "TEAM",
      participantName: "Case team",
      source: "NOTIFICATION"
    });
    expect(prisma.supportRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } })
    );
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          inAppVisible: true,
          OR: [{ caseId: null }, { case: { archivedAt: null } }],
          NOT: { type: { startsWith: "support.request_" } }
        }
      })
    );
  });

  it("returns an owner-scoped support conversation with its message history", async () => {
    prisma.supportRequest.findFirst.mockResolvedValue(
      createSupportRow({
        messages: [
          {
            id: "message-1",
            author: "SUPPORT",
            message: "We reviewed the additional evidence.",
            createdAt: new Date("2026-07-22T14:00:00.000Z")
          }
        ]
      })
    );

    const conversation = await service.get(userId, "SUPPORT_REQUEST", supportRequestId);

    expect(conversation.messages).toEqual([
      expect.objectContaining({ author: "USER", senderName: "You" }),
      expect.objectContaining({
        author: "SUPPORT",
        body: "We reviewed the additional evidence.",
        senderName: "ProofPilot Support"
      })
    ]);
    expect(prisma.supportRequest.findFirst).toHaveBeenCalledWith({
      where: { id: supportRequestId, userId },
      select: expect.any(Object)
    });
  });

  it("returns a system conversation detail from an owned notification", async () => {
    prisma.notification.findFirst.mockResolvedValue(
      createNotificationRow({ type: "packet_ready", title: "Packet generated" })
    );

    const conversation = await service.get(userId, "NOTIFICATION", notificationId);

    expect(conversation).toMatchObject({
      category: "SYSTEM",
      participantName: "Packet Generation",
      subject: "Packet generated"
    });
    expect(conversation.messages).toEqual([
      expect.objectContaining({ author: "SYSTEM", senderName: "Packet Generation" })
    ]);
  });

  it("rejects invalid conversation sources at the service boundary", async () => {
    await expect(service.get(userId, "EMAIL", notificationId)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("does not expose or mutate another user's conversation", async () => {
    prisma.supportRequest.findFirst.mockResolvedValue(null);
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.get(userId, "SUPPORT_REQUEST", supportRequestId)
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateReadState(userId, "NOTIFICATION", notificationId, true)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it("updates read state only after resolving ownership", async () => {
    prisma.supportRequest.findFirst.mockResolvedValue({ id: supportRequestId });
    prisma.supportRequest.update.mockResolvedValue({
      id: supportRequestId,
      readAt: new Date("2026-07-22T15:00:00.000Z")
    });

    await expect(
      service.updateReadState(userId, "SUPPORT_REQUEST", supportRequestId, true)
    ).resolves.toEqual({
      id: supportRequestId,
      readAt: "2026-07-22T15:00:00.000Z",
      source: "SUPPORT_REQUEST"
    });
    expect(prisma.supportRequest.findFirst).toHaveBeenCalledWith({
      where: { id: supportRequestId, userId },
      select: { id: true }
    });
    expect(prisma.supportRequest.update).toHaveBeenCalledWith({
      where: { id: supportRequestId },
      data: { readAt: expect.any(Date) },
      select: { id: true, readAt: true }
    });
  });

  it("marks only the user's projected inbox records read", async () => {
    prisma.supportRequest.updateMany.mockResolvedValue({ count: 2 });
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    await expect(service.markAllRead(userId)).resolves.toEqual({
      readAt: expect.any(String),
      updatedCount: 5
    });
    expect(prisma.supportRequest.updateMany).toHaveBeenCalledWith({
      where: { userId, readAt: null },
      data: { readAt: expect.any(Date) }
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        inAppVisible: true,
        readAt: null,
        OR: [{ caseId: null }, { case: { archivedAt: null } }],
        NOT: { type: { startsWith: "support.request_" } }
      },
      data: { readAt: expect.any(Date) }
    });
  });
});
