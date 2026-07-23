import {
  reportExportSections,
  type ReportCaseSummary,
  type ReportExportSection
} from "@proofpilot/types";

interface CsvColumn {
  header: string;
  value: (caseRecord: ReportCaseSummary) => string | number | null;
}

export function parseReportSections(value?: string): ReportExportSection[] {
  return value
    ? [...new Set(value.split(",") as ReportExportSection[])]
    : [...reportExportSections];
}

export function buildReportCsv(
  cases: ReportCaseSummary[],
  sections: ReportExportSection[]
) {
  const columns = sections.flatMap(getCsvColumns);
  const lines = [
    columns.map((column) => escapeCsvCell(column.header)).join(","),
    ...cases.map((caseRecord) =>
      columns.map((column) => escapeCsvCell(column.value(caseRecord))).join(",")
    )
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function slugifyReportName(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "case";
}

function getCsvColumns(section: ReportExportSection): CsvColumn[] {
  switch (section) {
    case "overview":
      return [
        { header: "Case ID", value: (caseRecord) => caseRecord.id },
        { header: "Title", value: (caseRecord) => caseRecord.title },
        { header: "Platform", value: (caseRecord) => caseRecord.platform },
        { header: "Status", value: (caseRecord) => caseRecord.status },
        { header: "Deadline", value: (caseRecord) => caseRecord.deadline },
        { header: "Created At", value: (caseRecord) => caseRecord.createdAt },
        { header: "Updated At", value: (caseRecord) => caseRecord.updatedAt },
        { header: "Completeness Percent", value: (caseRecord) => caseRecord.completeness }
      ];
    case "evidence":
      return [
        { header: "Evidence Files", value: (caseRecord) => caseRecord.documentCount },
        { header: "Evidence Bytes", value: (caseRecord) => caseRecord.evidenceByteSize }
      ];
    case "timeline":
      return [{ header: "Timeline Events", value: (caseRecord) => caseRecord.eventCount }];
    case "checklist":
      return [
        {
          header: "Checklist Complete",
          value: (caseRecord) => caseRecord.completedChecklistCount
        },
        { header: "Checklist Total", value: (caseRecord) => caseRecord.checklistCount }
      ];
    case "statement":
      return [{ header: "Statements", value: (caseRecord) => caseRecord.statementCount }];
    case "packet":
      return [{ header: "Packets", value: (caseRecord) => caseRecord.packetCount }];
  }
}

function escapeCsvCell(value: string | number | null) {
  const rawValue = value === null ? "" : String(value);
  const safeValue = /^\s*[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}
