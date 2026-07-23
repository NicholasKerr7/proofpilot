import { CheckCircle2, Clock3, ListChecks, TriangleAlert, UploadCloud } from "lucide-react";
import type { ReportCaseSummary } from "@proofpilot/types";
import { formatReportBytes } from "@/components/app/reports/report-utils";

export function getCaseInsights(caseRecord: ReportCaseSummary) {
  const openChecklistItems = Math.max(
    caseRecord.checklistCount - caseRecord.completedChecklistCount,
    0
  );

  return [
    {
      detail: `Current completeness is ${caseRecord.completeness}%.`,
      icon: caseRecord.completeness >= 80 ? CheckCircle2 : Clock3,
      iconClassName: caseRecord.completeness >= 80 ? "text-teal-300" : "text-primary",
      title:
        caseRecord.completeness >= 80
          ? "The case record is nearly complete"
          : "The case still needs preparation"
    },
    {
      detail: caseRecord.checklistCount
        ? `${caseRecord.completedChecklistCount} of ${caseRecord.checklistCount} requirements are complete or found.`
        : "Run checklist analysis after the first evidence files finish processing.",
      icon: openChecklistItems ? TriangleAlert : ListChecks,
      iconClassName: openChecklistItems ? "text-amber-300" : "text-teal-300",
      title: caseRecord.checklistCount
        ? openChecklistItems
          ? `${openChecklistItems} checklist ${openChecklistItems === 1 ? "item remains" : "items remain"}`
          : "Checklist coverage is complete"
        : "Checklist analysis has not run"
    },
    {
      detail: caseRecord.documentCount
        ? `${formatReportBytes(caseRecord.evidenceByteSize)} is stored across the current evidence files.`
        : "Upload relevant records before generating the final case packet.",
      icon: UploadCloud,
      iconClassName: caseRecord.documentCount ? "text-teal-300" : "text-amber-300",
      title: caseRecord.documentCount
        ? `${caseRecord.documentCount} evidence ${caseRecord.documentCount === 1 ? "file is" : "files are"} available`
        : "No evidence files are available"
    }
  ];
}

export function getCaseSummary(caseRecord: ReportCaseSummary, openChecklistItems: number) {
  if (!caseRecord.documentCount) {
    return "Start with the platform notice and account ownership records to improve this case's completeness.";
  }

  if (openChecklistItems) {
    return `Review ${openChecklistItems} remaining checklist ${openChecklistItems === 1 ? "item" : "items"} before generating the final packet.`;
  }

  return "The checklist is covered. Review the statement and generated packet before submitting through the platform.";
}

export function formatDeadline(value: string | null) {
  if (!value) {
    return "No deadline";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}
