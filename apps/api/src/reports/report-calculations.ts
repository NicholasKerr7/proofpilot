import {
  CaseStatus,
  ChecklistStatus,
  DocumentStatus,
  PacketStatus,
  Prisma
} from "@proofpilot/database";
import type {
  ReportCaseSummary,
  ReportEvidenceBreakdownItem,
  ReportEvidenceCategory,
  ReportSummary
} from "@proofpilot/types";
import { calculateCaseCompleteness } from "@proofpilot/types";

const completedChecklistStatuses = new Set<ChecklistStatus>([
  ChecklistStatus.COMPLETE,
  ChecklistStatus.FOUND
]);

export const reportCaseSelect = {
  id: true,
  title: true,
  platform: true,
  caseType: {
    select: { name: true }
  },
  status: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  documents: {
    select: {
      byteSize: true,
      mimeType: true,
      status: true
    }
  },
  checklist: {
    select: {
      status: true
    }
  },
  events: {
    select: {
      _count: { select: { sources: true } }
    }
  },
  _count: {
    select: {
      events: true,
      statements: true,
      packets: {
        where: {
          status: {
            in: [PacketStatus.READY, PacketStatus.DOWNLOADED]
          }
        }
      }
    }
  }
} satisfies Prisma.CaseSelect;

export type ReportCaseRecord = Prisma.CaseGetPayload<{ select: typeof reportCaseSelect }>;

export function buildReportSummary(
  cases: ReportCaseRecord[],
  caseId: string | null,
  now = new Date()
): ReportSummary {
  const caseSummaries = cases.map(toReportCaseSummary);
  const totalChecklistItems = sum(caseSummaries, (caseRecord) => caseRecord.checklistCount);
  const completedChecklistItems = sum(
    caseSummaries,
    (caseRecord) => caseRecord.completedChecklistCount
  );
  const totalCompleteness = sum(
    caseSummaries,
    (caseRecord) => caseRecord.completeness
  );
  const statusCounts = new Map<string, number>();

  for (const caseRecord of caseSummaries) {
    statusCounts.set(caseRecord.status, (statusCounts.get(caseRecord.status) ?? 0) + 1);
  }

  return {
    generatedAt: now.toISOString(),
    scope: {
      caseId,
      label: caseId ? caseSummaries[0]?.title ?? "Selected case" : "All cases"
    },
    metrics: {
      totalCases: caseSummaries.length,
      activeCases: caseSummaries.filter((caseRecord) => caseRecord.status !== CaseStatus.RESOLVED)
        .length,
      upcomingDeadlines: caseSummaries.filter(
        (caseRecord) =>
          caseRecord.deadline !== null &&
          caseRecord.status !== CaseStatus.RESOLVED &&
          new Date(caseRecord.deadline).getTime() >= now.getTime()
      ).length,
      averageCompleteness: caseSummaries.length
        ? Math.round(totalCompleteness / caseSummaries.length)
        : 0,
      totalDocuments: sum(caseSummaries, (caseRecord) => caseRecord.documentCount),
      failedDocuments: sum(
        cases,
        (caseRecord) =>
          caseRecord.documents.filter((document) => document.status === DocumentStatus.FAILED).length
      ),
      totalEvidenceBytes: sum(caseSummaries, (caseRecord) => caseRecord.evidenceByteSize),
      totalEvents: sum(caseSummaries, (caseRecord) => caseRecord.eventCount),
      totalChecklistItems,
      completedChecklistItems,
      missingChecklistItems: sum(
        cases,
        (caseRecord) =>
          caseRecord.checklist.filter(
            (item) =>
              !completedChecklistStatuses.has(item.status) &&
              item.status !== ChecklistStatus.OPTIONAL
          ).length
      ),
      totalStatements: sum(caseSummaries, (caseRecord) => caseRecord.statementCount),
      totalPackets: sum(caseSummaries, (caseRecord) => caseRecord.packetCount)
    },
    evidenceBreakdown: createEvidenceBreakdown(cases),
    statusBreakdown: Array.from(statusCounts, ([status, count]) => ({ status, count })),
    cases: caseSummaries
  };
}

export function toReportCaseSummary(caseRecord: ReportCaseRecord): ReportCaseSummary {
  const requiredChecklist = caseRecord.checklist.filter(
    (item) => item.status !== ChecklistStatus.OPTIONAL
  );
  const completedChecklistCount = requiredChecklist.filter((item) =>
    completedChecklistStatuses.has(item.status)
  ).length;
  const documentCount = caseRecord.documents.length;
  const evidenceByteSize = caseRecord.documents.reduce(
    (total, document) => total + document.byteSize,
    0
  );
  const checklistCount = requiredChecklist.length;
  const completeness = calculateCaseCompleteness({
    caseTypeName: caseRecord.caseType.name,
    checklistStatuses: caseRecord.checklist.map((item) => item.status),
    eventCount: caseRecord._count.events,
    failedDocumentCount: caseRecord.documents.filter(
      (document) => document.status === DocumentStatus.FAILED
    ).length,
    platform: caseRecord.platform,
    processedDocumentCount: caseRecord.documents.filter(
      (document) => document.status === DocumentStatus.PROCESSED
    ).length,
    sourcedEventCount: caseRecord.events.filter(
      (event) => event._count.sources > 0
    ).length,
    statementCount: caseRecord._count.statements,
    title: caseRecord.title,
    totalDocumentCount: documentCount
  }).score;

  return {
    id: caseRecord.id,
    title: caseRecord.title,
    platform: caseRecord.platform,
    status: caseRecord.status,
    deadline: caseRecord.deadline?.toISOString() ?? null,
    createdAt: caseRecord.createdAt.toISOString(),
    updatedAt: caseRecord.updatedAt.toISOString(),
    completeness,
    documentCount,
    evidenceByteSize,
    eventCount: caseRecord._count.events,
    completedChecklistCount,
    checklistCount,
    statementCount: caseRecord._count.statements,
    packetCount: caseRecord._count.packets
  };
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
