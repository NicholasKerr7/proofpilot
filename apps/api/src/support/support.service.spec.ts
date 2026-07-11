import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
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
      orderBy: { createdAt: "desc" },
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
        priority: "NORMAL"
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId: "case-1",
        type: "support.request_received",
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
