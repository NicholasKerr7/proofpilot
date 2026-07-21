import type { CaseRecord } from "@/lib/client/types";

export type CaseDestinationId =
  | "case-overview"
  | "evidence-intake"
  | "case-timeline"
  | "evidence-checklist"
  | "statement-builder"
  | "packet-export"
  | "case-reminders"
  | "case-activity";

export type CaseStatusVariant = "default" | "secondary" | "success" | "warning";

export type CaseNextAction = {
  destinationId: CaseDestinationId;
  detail: string;
  label: string;
  status: string;
  variant: CaseStatusVariant;
  wide?: boolean;
};

export function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
}

export function getCompletedChecklistCount(caseRecord: CaseRecord) {
  return (caseRecord.checklist ?? []).filter((item) => isChecklistReady(item.status)).length;
}

export function getMissingChecklistCount(caseRecord: CaseRecord) {
  const checklistItems = caseRecord.checklist ?? [];

  if (checklistItems.length) {
    return checklistItems.filter((item) => !isChecklistReady(item.status)).length;
  }

  return caseRecord.status === "NEEDS_MORE_EVIDENCE" ? caseRecord._count?.checklist ?? 0 : 0;
}

export function getCaseReadiness(caseRecord: CaseRecord) {
  const documentScore = Math.min(40, (caseRecord._count?.documents ?? 0) * 10);
  const eventScore = Math.min(25, (caseRecord.events?.length ?? caseRecord._count?.events ?? 0) * 8);
  const checklistItems = caseRecord.checklist ?? [];
  const checklistScore = checklistItems.length
    ? Math.round((getCompletedChecklistCount(caseRecord) / checklistItems.length) * 25)
    : Math.min(25, (caseRecord._count?.checklist ?? 0) * 5);
  const statementScore = caseRecord.summary || caseRecord._count?.statements ? 10 : 0;

  return Math.min(100, documentScore + eventScore + checklistScore + statementScore);
}

export function getCaseNextActions(caseRecord: CaseRecord): CaseNextAction[] {
  const readiness = getCaseReadiness(caseRecord);
  const documentCount = caseRecord._count?.documents ?? 0;
  const eventCount = caseRecord.events?.length ?? caseRecord._count?.events ?? 0;
  const missingChecklistItems = getMissingChecklistCount(caseRecord);
  const hasStatement = Boolean(caseRecord.summary || caseRecord._count?.statements);
  const failedDocuments = caseRecord.documentStats?.failed ?? 0;

  const actions: CaseNextAction[] = [
    {
      destinationId: "evidence-intake",
      detail: "Upload notices, support threads, statements, and account ownership proof.",
      label: "Add evidence",
      status: documentCount ? `${documentCount} files` : "Start here",
      variant: documentCount ? "success" : "warning"
    },
    {
      destinationId: "evidence-checklist",
      detail: "Review missing requirements and matched evidence before generating a packet.",
      label: "Close checklist gaps",
      status: missingChecklistItems ? `${missingChecklistItems} missing` : "Ready",
      variant: missingChecklistItems ? "warning" : "success"
    },
    {
      destinationId: "case-timeline",
      detail: "Confirm the sequence of notices, support contact, drafts, and platform responses.",
      label: "Verify timeline",
      status: eventCount ? `${eventCount} events` : "Draft",
      variant: eventCount ? "secondary" : "warning"
    },
    {
      destinationId: "statement-builder",
      detail: "Draft or refine the appeal statement using the evidence and timeline.",
      label: "Prepare statement",
      status: hasStatement ? "Draft ready" : "Needs draft",
      variant: hasStatement ? "success" : "warning"
    },
    {
      destinationId: "packet-export",
      detail: "Generate the final case packet after evidence, checklist, and statement review.",
      label: "Generate packet",
      status: readiness >= 80 ? "Ready" : `${readiness}% ready`,
      variant: readiness >= 80 ? "success" : "secondary",
      wide: true
    }
  ];

  if (failedDocuments) {
    actions.unshift({
      destinationId: "evidence-intake",
      detail: "Open failed evidence files, review processing details, and retry when ready.",
      label: "Review failed processing",
      status: `${failedDocuments} failed`,
      variant: "warning"
    });
  }

  return actions;
}

export function formatCaseStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getCaseStatusVariant(status: string): CaseStatusVariant {
  if (status === "NEEDS_MORE_EVIDENCE") {
    return "warning";
  }

  if (status === "READY_FOR_REVIEW" || status === "PROCESSING") {
    return "secondary";
  }

  if (status === "PACKET_GENERATED" || status === "SUBMITTED" || status === "RESOLVED") {
    return "success";
  }

  return "default";
}

export function formatCaseDate(value: string, includeYear = true) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {})
  }).format(new Date(value));
}

export function formatCaseReference(caseRecord: CaseRecord) {
  const year = new Date(caseRecord.createdAt).getFullYear();
  const numericHash = Array.from(caseRecord.id).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 10_000,
    0
  );

  return `PP-${year}-${String(numericHash).padStart(4, "0")}`;
}

export function getCaseProgressMessage(readiness: number) {
  if (readiness >= 90) {
    return "Your packet is nearly ready for final review.";
  }

  if (readiness >= 60) {
    return "You are making progress. Close the remaining evidence gaps next.";
  }

  if (readiness >= 30) {
    return "The case is taking shape. Keep adding evidence and timeline details.";
  }

  return "Start with the strongest notice, support response, and account ownership proof.";
}
