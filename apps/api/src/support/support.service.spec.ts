import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  SupportMessageAuthor,
  SupportRequestCategory,
  SupportRequestPriority,
  SupportRequestStatus
} from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { SupportService } from "./support.service.js";

const ownerId = "user-1";
const createdAt = new Date("2026-07-11T16:00:00.000Z");
const updatedAt = new Date("2026-07-11T16:05:00.000Z");

function createPrismaMock() {
  const transactionClient = {
    supportRequest: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    supportRequestMessage: {
      create: vi.fn()
    },
    notification: {
      create: vi.fn().mockResolvedValue({})
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  return {
    transactionClient,
    case: {
      findFirst: vi.fn()
    },
    supportRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    $transaction: vi.fn(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient)
    )
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new SupportService(prisma as unknown as PrismaService);
}

function createSupportRequestRow() {
  return {
    id: "request-1",
    caseId: "case-1",
    category: SupportRequestCategory.CASE_ASSISTANCE,
    subject: "Help reviewing missing evidence",
    message: "Please help me understand which ownership document is still missing.",
    priority: SupportRequestPriority.NORMAL,
    status: SupportRequestStatus.OPEN,
    createdAt,
    updatedAt,
    case: {
      id: "case-1",
      title: "PayPal account appeal",
      platform: "PayPal"
    }
  };
}

function createSupportRequestMessageRow() {
  return {
    id: "message-1",
    requestId: "request-1",
    author: SupportMessageAuthor.USER,
    message: "The same upload error also occurs in Safari.",
    createdAt: updatedAt
  };
}

describe("SupportService", () => {
  let prisma: PrismaMock;
  let service: SupportService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = createService(prisma);
  });

  it("lists only support requests owned by the current user", async () => {
    prisma.supportRequest.findMany.mockResolvedValue([createSupportRequestRow()]);

    const result = await service.listRequests(ownerId);

    expect(prisma.supportRequest.findMany).toHaveBeenCalledWith({
      where: { userId: ownerId },
      orderBy: { updatedAt: "desc" },
      select: expect.any(Object),
      take: 20
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "request-1",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString()
      })
    );
  });

  it("creates a request for an owned case with a receipt and redacted audit metadata", async () => {
    const requestRow = createSupportRequestRow();
    prisma.case.findFirst.mockResolvedValue({ id: "case-1", title: "PayPal account appeal" });
    prisma.transactionClient.supportRequest.create.mockResolvedValue(requestRow);

    const result = await service.createRequest(ownerId, {
      caseId: "case-1",
      category: "CASE_ASSISTANCE",
      subject: "  Help reviewing missing evidence  ",
      message: "  Please help me understand which ownership document is still missing.  ",
      priority: "NORMAL"
    });

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        id: "case-1",
        ownerId,
        archivedAt: null
      },
      select: {
        id: true,
        title: true
      }
    });
    expect(prisma.transactionClient.supportRequest.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId: "case-1",
        category: "CASE_ASSISTANCE",
        subject: "Help reviewing missing evidence",
        message: "Please help me understand which ownership document is still missing.",
        priority: "NORMAL",
        readAt: expect.any(Date)
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId: "case-1",
        type: "support.request_received:request-1",
        title: "Support request received",
        body: "Your request about PayPal account appeal is in the support queue."
      }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId: "case-1",
        action: "support.request_created",
        metadata: {
          requestId: "request-1",
          category: "CASE_ASSISTANCE",
          priority: "NORMAL",
          subject: "Help reviewing missing evidence"
        }
      }
    });
    expect(result.id).toBe("request-1");
  });

  it("loads an owned support request with its follow-up thread", async () => {
    prisma.supportRequest.findFirst.mockResolvedValue({
      ...createSupportRequestRow(),
      messages: [createSupportRequestMessageRow()]
    });

    const result = await service.getRequest(ownerId, "request-1");

    expect(prisma.supportRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: "request-1",
        userId: ownerId
      },
      select: expect.any(Object)
    });
    expect(result.messages).toEqual([
      expect.objectContaining({
        id: "message-1",
        author: "USER",
        createdAt: updatedAt.toISOString()
      })
    ]);
  });

  it("does not expose a support request outside the current owner scope", async () => {
    prisma.supportRequest.findFirst.mockResolvedValue(null);

    await expect(service.getRequest(ownerId, "request-other")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("adds a trimmed follow-up to an owned open request without auditing its content", async () => {
    const messageRow = createSupportRequestMessageRow();
    prisma.supportRequest.findFirst.mockResolvedValue({
      id: "request-1",
      caseId: "case-1",
      status: SupportRequestStatus.OPEN,
      subject: "Help reviewing missing evidence"
    });
    prisma.transactionClient.supportRequestMessage.create.mockResolvedValue(messageRow);

    const result = await service.addRequestMessage(ownerId, "request-1", {
      message: "  The same upload error also occurs in Safari.  "
    });

    expect(prisma.supportRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: "request-1",
        userId: ownerId
      },
      select: {
        id: true,
        caseId: true,
        status: true,
        subject: true
      }
    });
    expect(prisma.transactionClient.supportRequestMessage.create).toHaveBeenCalledWith({
      data: {
        requestId: "request-1",
        author: "USER",
        message: "The same upload error also occurs in Safari."
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.supportRequest.update).toHaveBeenCalledWith({
      where: { id: "request-1" },
      data: { readAt: expect.any(Date), updatedAt: expect.any(Date) }
    });
    expect(prisma.transactionClient.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId: "case-1",
        type: "support.request_updated:request-1",
        title: "Support follow-up received",
        body: "Your follow-up for Help reviewing missing evidence was added to the request."
      }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId: "case-1",
        action: "support.request_message_added",
        metadata: {
          requestId: "request-1"
        }
      }
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: "message-1",
        createdAt: updatedAt.toISOString()
      })
    );
  });

  it("rejects follow-ups for resolved or non-owned support requests", async () => {
    prisma.supportRequest.findFirst.mockResolvedValue({
      id: "request-1",
      caseId: null,
      status: SupportRequestStatus.RESOLVED,
      subject: "Resolved request"
    });

    await expect(
      service.addRequestMessage(ownerId, "request-1", { message: "Please reopen this." })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    prisma.supportRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.addRequestMessage(ownerId, "request-other", { message: "Please reopen this." })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects whitespace-only support follow-ups at the service boundary", async () => {
    await expect(
      service.addRequestMessage(ownerId, "request-1", { message: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.supportRequest.findFirst).not.toHaveBeenCalled();
  });

  it("rejects oversized support follow-ups at the service boundary", async () => {
    await expect(
      service.addRequestMessage(ownerId, "request-1", { message: "x".repeat(5001) })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.supportRequest.findFirst).not.toHaveBeenCalled();
  });

  it("does not create a request for a case outside the current owner scope", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(
      service.createRequest(ownerId, {
        caseId: "case-other",
        category: "CASE_ASSISTANCE",
        subject: "Help with this appeal",
        message: "Please help me review the evidence for this account appeal.",
        priority: "HIGH"
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only support content at the service boundary", async () => {
    await expect(
      service.createRequest(ownerId, {
        category: "OTHER",
        subject: "     ",
        message: "                         ",
        priority: "LOW"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records article feedback without storing article content", async () => {
    const result = await service.recordArticleFeedback(ownerId, {
      articleSlug: "upload-evidence",
      helpful: true
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        action: "help.article_feedback_recorded",
        metadata: {
          articleSlug: "upload-evidence",
          helpful: true
        }
      }
    });
    expect(result).toEqual({ recorded: true });
  });
});
