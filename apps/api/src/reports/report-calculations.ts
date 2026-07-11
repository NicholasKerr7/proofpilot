import { ChecklistStatus, Prisma } from "@proofpilot/database";
import type {
  ReportCaseSummary,
  ReportEvidenceBreakdownItem,
  ReportEvidenceCategory,
  ReportSummary
} from "@proofpilot/types";

const completedChecklistStatuses = new Set<ChecklistStatus>([
  ChecklistStatus.COMPLETE,
  ChecklistStatus.FOUND
]);

export const reportCaseSelect = {
  id: true,
  title: true,
  platform: true,
  status: true,
  summary: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  documents: {
    select: {
      byteSize: true,
      mimeType: true
    }
  },
  checklist: {
    select: {
      status: true
    }
  },
  _count: {
    select: {
      events: true,
      statements: true,
      packets: true
    }
  }
} satisfies Prisma.CaseSelect;

export type ReportCaseRecord = Prisma.CaseGetPayload<{ select: typeof reportCaseSelect }>;

export function buildReportSummary(
  cases: ReportCaseRecord[],
  caseId: string | null
): ReportSummary {
  const caseSummaries = cases.map(toReportCaseSummary);
  const totalChecklistItems = sum(caseSummaries, (caseRecord) => caseRecord.checklistCount);
  const completedChecklistItems = sum(
    caseSummaries,
    (caseRecord) => caseRecord.completedChecklistCount
  );
  const totalReadiness = sum(caseSummaries, (caseRecord) => caseRecord.readiness);
  const statusCounts = new Map<string, number>();

  for (const caseRecord of caseSummaries) {
    statusCounts.set(caseRecord.status, (statusCounts.get(caseRecord.status) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      caseId,
      label: caseId ? caseSummaries[0]?.title ?? "Selected case" : "All cases"
    },
    metrics: {
      totalCases: caseSummaries.length,
      activeCases: caseSummaries.filter((caseRecord) => caseRecord.status !== "RESOLVED").length,
      averageReadiness: caseSummaries.length
        ? Math.round(totalReadiness / caseSummaries.length)
        : 0,
      totalDocuments: sum(caseSummaries, (caseRecord) => caseRecord.documentCount),
      totalEvidenceBytes: sum(caseSummaries, (caseRecord) => caseRecord.evidenceByteSize),
      totalEvents: sum(caseSummaries, (caseRecord) => caseRecord.eventCount),
      totalChecklistItems,
      completedChecklistItems,
      totalStatements: sum(caseSummaries, (caseRecord) => caseRecord.statementCount),
      totalPackets: sum(caseSummaries, (caseRecord) => caseRecord.packetCount)
    },
    evidenceBreakdown: createEvidenceBreakdown(cases),
    statusBreakdown: Array.from(statusCounts, ([status, count]) => ({ status, count })),
    cases: caseSummaries
  };
}

export function toReportCaseSummary(caseRecord: ReportCaseRecord): ReportCaseSummary {
  const completedChecklistCount = caseRecord.checklist.filter((item) =>
    completedChecklistStatuses.has(item.status)
  ).length;
  const documentCount = caseRecord.documents.length;
  const evidenceByteSize = caseRecord.documents.reduce(
    (total, document) => total + document.byteSize,
    0
  );
  const checklistCount = caseRecord.checklist.length;
  const readiness = calculateReadiness({
    documentCount,
    eventCount: caseRecord._count.events,
    checklistCount,
    completedChecklistCount,
    hasStatement: Boolean(caseRecord.summary || caseRecord._count.statements)
  });

  return {
    id: caseRecord.id,
    title: caseRecord.title,
    platform: caseRecord.platform,
    status: caseRecord.status,
    deadline: caseRecord.deadline?.toISOString() ?? null,
    createdAt: caseRecord.createdAt.toISOString(),
    updatedAt: caseRecord.updatedAt.toISOString(),
    readiness,
    documentCount,
    evidenceByteSize,
    eventCount: caseRecord._count.events,
    completedChecklistCount,
    checklistCount,
    statementCount: caseRecord._count.statements,
    packetCount: caseRecord._count.packets
  };
}

function calculateReadiness(input: {
  documentCount: number;
  eventCount: number;
  checklistCount: number;
  completedChecklistCount: number;
  hasStatement: boolean;
}) {
  const documentScore = Math.min(40, input.documentCount * 10);
  const eventScore = Math.min(25, input.eventCount * 8);
  const checklistScore = input.checklistCount
    ? Math.round((input.completedChecklistCount / input.checklistCount) * 25)
    : 0;
  const statementScore = input.hasStatement ? 10 : 0;
  return Math.min(100, documentScore + eventScore + checklistScore + statementScore);
}

function createEvidenceBreakdown(cases: ReportCaseRecord[]): ReportEvidenceBreakdownItem[] {
  const categoryMap = new Map<ReportEvidenceCategory, { count: number; byteSize: number }>(
    (["images", "documents", "emails", "data", "other"] as const).map((category) => [
      category,
      { count: 0, byteSize: 0 }
    ])
  );

  for (const caseRecord of cases) {
    for (const document of caseRecord.documents) {
      const category = getEvidenceCategory(document.mimeType);
      const current = categoryMap.get(category);

      if (current) {
        current.count += 1;
        current.byteSize += document.byteSize;
      }
    }
  }

  return Array.from(categoryMap, ([category, values]) => ({ category, ...values }));
}

function getEvidenceCategory(mimeType: string): ReportEvidenceCategory {
  if (mimeType.startsWith("image/")) {
    return "images";
  }

  if (mimeType === "message/rfc822") {
    return "emails";
  }

  if (mimeType.includes("csv") || mimeType.includes("json") || mimeType.includes("spreadsheet")) {
    return "data";
  }

  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("document")
  ) {
    return "documents";
  }

  return "other";
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}
