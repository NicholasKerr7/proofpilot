import type {
  ReportEvidenceCategory,
  ReportExportSection,
  ReportSummary
} from "@proofpilot/types";

export const reportSectionOptions: Array<{
  label: string;
  value: ReportExportSection;
}> = [
  { label: "Case overview", value: "overview" },
  { label: "Documents & evidence", value: "evidence" },
  { label: "Timeline activity", value: "timeline" },
  { label: "Evidence checklist", value: "checklist" },
  { label: "Statement status", value: "statement" },
  { label: "Packet history", value: "packet" }
];

export const evidenceCategoryLabels: Record<ReportEvidenceCategory, string> = {
  images: "Images",
  documents: "Documents",
  emails: "Email files",
  data: "Data files",
  other: "Other"
};

export function formatReportBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatReportDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatReportStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getChecklistCompletion(summary: ReportSummary) {
  const { completedChecklistItems, totalChecklistItems } = summary.metrics;
  return totalChecklistItems
    ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
    : 0;
}

export function getReportDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getReportFilename(response: Response) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? `proofpilot-report-${getReportDateValue(new Date())}.csv`;
}
