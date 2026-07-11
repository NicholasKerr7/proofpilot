import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CaseStatus, ChecklistStatus } from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { ReportsService } from "./reports.service.js";

const ownerId = "user-1";
const createdAt = new Date("2026-05-01T12:00:00.000Z");
const updatedAt = new Date("2026-07-11T12:00:00.000Z");

function createPrismaMock() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    case: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new ReportsService(prisma as unknown as PrismaService);
}

interface ReportCaseFixture {
  id: string;
  title: string;
  platform: string;
  status: CaseStatus;
  summary: string | null;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  documents: Array<{
    byteSize: number;
    mimeType: string;
  }>;
  checklist: Array<{
    status: ChecklistStatus;
  }>;
  _count: {
    events: number;
    statements: number;
    packets: number;
  };
}

function createReportCase(overrides: Partial<ReportCaseFixture> = {}) {
  return {
    ...baseReportCase(),
    ...overrides
  };
}

function baseReportCase(): ReportCaseFixture {
  return {
    id: "case-1",
    title: "PayPal account appeal",
    platform: "PayPal",
    status: CaseStatus.NEEDS_MORE_EVIDENCE,
    summary: "Appeal summary",
    deadline: new Date("2026-08-01T12:00:00.000Z"),
    createdAt,
    updatedAt,
    documents: [
      { byteSize: 1000, mimeType: "application/pdf" },
      { byteSize: 500, mimeType: "text/csv" }
    ],
    checklist: [
      { status: ChecklistStatus.COMPLETE },
      { status: ChecklistStatus.MISSING }
    ],
    _count: {
      events: 3,
      statements: 1,
      packets: 1
    }
  };
}

describe("ReportsService", () => {
  let prisma: PrismaMock;
  let service: ReportsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = createService(prisma);
  });

  it("builds current analytics from owned cases", async () => {
    prisma.case.findMany.mockResolvedValue([
      createReportCase(),
      createReportCase({
        id: "case-2",
        title: "Marketplace suspension",
        platform: "eBay",
        status: CaseStatus.COLLECTING_EVIDENCE,
        summary: null,
        documents: [{ byteSize: 2000, mimeType: "image/png" }],
        checklist: [{ status: ChecklistStatus.FOUND }],
        _count: { events: 1, statements: 0, packets: 0 }
      })
    ]);

    const result = await service.getSummary(ownerId, {});

    expect(prisma.case.findMany).toHaveBeenCalledWith({
      where: {
        ownerId,
        archivedAt: null
      },
      orderBy: { updatedAt: "desc" },
      select: expect.any(Object)
    });
    expect(result.scope).toEqual({ caseId: null, label: "All cases" });
    expect(result.metrics).toEqual({
      totalCases: 2,
      activeCases: 2,
      averageReadiness: 55,
      totalDocuments: 3,
      totalEvidenceBytes: 3500,
      totalEvents: 4,
      totalChecklistItems: 3,
      completedChecklistItems: 2,
      totalStatements: 1,
      totalPackets: 1
    });
    expect(result.cases.map((caseRecord) => caseRecord.readiness)).toEqual([67, 43]);
    expect(result.evidenceBreakdown).toEqual([
      { category: "images", count: 1, byteSize: 2000 },
      { category: "documents", count: 1, byteSize: 1000 },
      { category: "emails", count: 0, byteSize: 0 },
      { category: "data", count: 1, byteSize: 500 },
      { category: "other", count: 0, byteSize: 0 }
    ]);
  });

  it("does not expose a case outside the current owner scope", async () => {
    prisma.case.findMany.mockResolvedValue([]);

    await expect(service.getSummary(ownerId, { caseId: "case-other" })).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId,
          archivedAt: null,
          id: "case-other"
        }
      })
    );
  });

  it("exports selected CSV sections, neutralizes formulas, and records an audit event", async () => {
    const reportCase = createReportCase({
      title: '=IMPORTXML("https://example.com")'
    });
    prisma.case.findFirst.mockResolvedValue({
      id: reportCase.id,
      title: reportCase.title
    });
    prisma.case.findMany.mockResolvedValue([reportCase]);

    const result = await service.exportCsv(ownerId, {
      caseId: reportCase.id,
      from: "2026-07-01",
      to: "2026-07-31",
      sections: "overview,evidence"
    });

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId,
          archivedAt: null,
          id: reportCase.id,
          auditLogs: {
            some: {
              createdAt: {
                gte: new Date("2026-07-01T00:00:00.000Z"),
                lte: new Date("2026-07-31T23:59:59.999Z")
              }
            }
          }
        }
      })
    );
    expect(result.filename).toMatch(/^importxml-https-example-com-report-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.content).toContain('"\'=IMPORTXML(""https://example.com"")"');
    expect(result.content).toContain('"Evidence Files"');
    expect(result.content).not.toContain('"Timeline Events"');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId: reportCase.id,
        action: "report.csv_exported",
        metadata: {
          sections: ["overview", "evidence"],
          rowCount: 1,
          from: "2026-07-01",
          to: "2026-07-31"
        }
      }
    });
  });

  it("does not export a selected case outside the current owner scope", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(
      service.exportCsv(ownerId, { caseId: "case-other" })
    ).rejects.toBeInstanceOf(NotFoundException);

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
    expect(prisma.case.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an inverted export date range before querying cases", async () => {
    await expect(
      service.exportCsv(ownerId, {
        from: "2026-07-31",
        to: "2026-07-01"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.case.findFirst).not.toHaveBeenCalled();
    expect(prisma.case.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an impossible calendar date before querying cases", async () => {
    await expect(service.exportCsv(ownerId, { from: "2026-02-29" })).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(prisma.case.findFirst).not.toHaveBeenCalled();
    expect(prisma.case.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
