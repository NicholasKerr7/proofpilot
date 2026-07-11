import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  CaseStatus,
  ChecklistStatus,
  DocumentStatus,
  PacketStatus,
  SupportRequestStatus
} from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { SearchService } from "./search.service.js";

const ownerId = "user-1";
const baseDate = new Date("2026-07-11T15:00:00.000Z");
const foundCase = {
  id: "case-1",
  title: "PayPal account closure appeal",
  platform: "PayPal"
};

function createPrismaMock() {
  return {
    case: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([])
    },
    document: {
      findMany: vi.fn().mockResolvedValue([])
    },
    caseEvent: {
      findMany: vi.fn().mockResolvedValue([])
    },
    caseChecklistItem: {
      findMany: vi.fn().mockResolvedValue([])
    },
    caseStatement: {
      findMany: vi.fn().mockResolvedValue([])
    },
    casePacket: {
      findMany: vi.fn().mockResolvedValue([])
    },
    supportRequest: {
      findMany: vi.fn().mockResolvedValue([])
    }
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new SearchService(prisma as unknown as PrismaService);
}

describe("SearchService", () => {
  let prisma: PrismaMock;
  let service: SearchService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = createService(prisma);
  });

  it("searches real resources through explicit owner scopes", async () => {
    prisma.case.findMany.mockResolvedValue([
      {
        id: foundCase.id,
        title: foundCase.title,
        platform: foundCase.platform,
        summary: "PayPal closed the account after a review.",
        status: CaseStatus.NEEDS_MORE_EVIDENCE,
        updatedAt: baseDate
      }
    ]);
    prisma.document.findMany.mockResolvedValue([
      {
        id: "document-1",
        originalName: "paypal-notice.pdf",
        extractedText: "PayPal account closure notice",
        mimeType: "application/pdf",
        byteSize: 2048,
        status: DocumentStatus.PROCESSED,
        updatedAt: new Date("2026-07-11T14:00:00.000Z"),
        case: foundCase
      }
    ]);
    prisma.caseEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        title: "Contacted PayPal support",
        description: "Opened support ticket PP-100.",
        occurredAt: new Date("2026-07-10T12:00:00.000Z"),
        case: foundCase
      }
    ]);
    prisma.caseChecklistItem.findMany.mockResolvedValue([
      {
        id: "check-1",
        label: "PayPal closure notice",
        description: "Upload the original platform notice.",
        status: ChecklistStatus.FOUND,
        updatedAt: new Date("2026-07-09T12:00:00.000Z"),
        case: foundCase
      }
    ]);
    prisma.caseStatement.findMany.mockResolvedValue([
      {
        id: "statement-1",
        content: "I am requesting a review of the PayPal closure.",
        updatedAt: new Date("2026-07-08T12:00:00.000Z"),
        case: foundCase
      }
    ]);
    prisma.casePacket.findMany.mockResolvedValue([
      {
        id: "packet-1",
        status: PacketStatus.READY,
        updatedAt: new Date("2026-07-07T12:00:00.000Z"),
        _count: { exports: 1 },
        case: foundCase
      }
    ]);
    prisma.supportRequest.findMany.mockResolvedValue([
      {
        id: "support-1",
        subject: "PayPal evidence question",
        message: "Please review the PayPal account records.",
        status: SupportRequestStatus.OPEN,
        updatedAt: new Date("2026-07-06T12:00:00.000Z"),
        case: foundCase
      }
    ]);

    const result = await service.search(ownerId, { q: "PayPal" });

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId, archivedAt: null })
      })
    );
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          case: { ownerId, archivedAt: null }
        })
      })
    );
    expect(prisma.supportRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: ownerId })
      })
    );
    expect(result.scope).toEqual({ caseId: null, label: "All cases" });
    expect(result.total).toBe(7);
    expect(result.counts).toEqual({
      CASE: 1,
      DOCUMENT: 1,
      TIMELINE: 1,
      CHECKLIST: 1,
      STATEMENT: 1,
      PACKET: 1,
      SUPPORT: 1
    });
    expect(result.results[0]).toEqual(
      expect.objectContaining({ id: "case-1", type: "CASE", status: "NEEDS_MORE_EVIDENCE" })
    );
    expect(result.results.find((item) => item.id === "document-1")?.file).toEqual({
      mimeType: "application/pdf",
      byteSize: 2048
    });
  });

  it("does not search a case outside the current owner scope", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.search(ownerId, { caseId: "case-other" })).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        id: "case-other",
        ownerId,
        archivedAt: null
      },
      select: {
        id: true,
        title: true
      }
    });
    expect(prisma.document.findMany).not.toHaveBeenCalled();
    expect(prisma.supportRequest.findMany).not.toHaveBeenCalled();
  });

  it("applies normalized state and date filters only to compatible result types", async () => {
    await service.search(ownerId, {
      from: "2026-07-01",
      to: "2026-07-31",
      status: "NEEDS_ATTENTION",
      types: "CASE,DOCUMENT,TIMELINE,SUPPORT"
    });

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [CaseStatus.NEEDS_MORE_EVIDENCE] },
          updatedAt: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-31T23:59:59.999Z")
          }
        })
      })
    );
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [DocumentStatus.FAILED, DocumentStatus.NEEDS_REVIEW] }
        })
      })
    );
    expect(prisma.caseEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.supportRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: ownerId,
          status: { in: [SupportRequestStatus.OPEN] }
        })
      })
    );
  });

  it("caps each resource group and reports when more matches exist", async () => {
    prisma.case.findMany.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        id: `case-${index}`,
        title: `Appeal ${index}`,
        platform: "PayPal",
        summary: null,
        status: CaseStatus.COLLECTING_EVIDENCE,
        updatedAt: new Date(baseDate.getTime() - index * 1000)
      }))
    );

    const result = await service.search(ownerId, { types: "CASE" });

    expect(result.total).toBe(8);
    expect(result.counts.CASE).toBe(8);
    expect(result.hasMore).toEqual(["CASE"]);
  });

  it("rejects impossible calendar dates before querying resources", async () => {
    await expect(service.search(ownerId, { from: "2026-02-29" })).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(prisma.case.findMany).not.toHaveBeenCalled();
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });

  it("rejects a result limit outside the service boundary", async () => {
    await expect(service.search(ownerId, { limit: 51 })).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(prisma.case.findMany).not.toHaveBeenCalled();
  });
});
