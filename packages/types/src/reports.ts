export const reportExportSections = [
  "overview",
  "evidence",
  "timeline",
  "checklist",
  "statement",
  "packet"
] as const;

export type ReportExportSection = (typeof reportExportSections)[number];
export type ReportEvidenceCategory = "images" | "documents" | "emails" | "data" | "other";

export interface ReportMetrics {
  totalCases: number;
  activeCases: number;
  averageReadiness: number;
  totalDocuments: number;
  totalEvidenceBytes: number;
  totalEvents: number;
  totalChecklistItems: number;
  completedChecklistItems: number;
  totalStatements: number;
  totalPackets: number;
}

export interface ReportEvidenceBreakdownItem {
  category: ReportEvidenceCategory;
  count: number;
  byteSize: number;
}

export interface ReportStatusBreakdownItem {
  status: string;
  count: number;
}

export interface ReportCaseSummary {
  id: string;
  title: string;
  platform: string;
  status: string;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  readiness: number;
  documentCount: number;
  evidenceByteSize: number;
  eventCount: number;
  completedChecklistCount: number;
  checklistCount: number;
  statementCount: number;
  packetCount: number;
}

export interface ReportSummary {
  generatedAt: string;
  scope: {
    caseId: string | null;
    label: string;
  };
  metrics: ReportMetrics;
  evidenceBreakdown: ReportEvidenceBreakdownItem[];
  statusBreakdown: ReportStatusBreakdownItem[];
  cases: ReportCaseSummary[];
}
