import {
  calculateCaseCompleteness,
  caseCompletenessWeights,
  formatCaseReference as formatSharedCaseReference
} from "@proofpilot/types";
import type { CaseRecord } from "@/lib/client/types";

export type CaseDestinationId =
  | "case-overview"
  | "proof-map"
  | "evidence-intake"
  | "case-timeline"
  | "evidence-checklist"
  | "statement-builder"
  | "packet-export"
  | "submission-tracker"
  | "case-reminders"
  | "case-activity";

export type CaseStatusVariant = "default" | "secondary" | "success" | "warning";

export type CaseCompletenessStatus = "complete" | "missing" | "partial";

export type CaseCompletenessCriterion = {
  destinationId: CaseDestinationId;
  detail: string;
  earned: number;
  id: "case-details" | "evidence" | "requirements" | "statement" | "timeline";
  label: string;
  status: CaseCompletenessStatus;
  weight: number;
};

export type CaseCompleteness = {
  capReasons: string[];
  criteria: CaseCompletenessCriterion[];
  rawScore: number;
  score: number;
};

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
  return (caseRecord.checklist ?? []).filter(
    (item) => item.status !== "OPTIONAL" && isChecklistReady(item.status)
  ).length;
}

export function getRequiredChecklistCount(caseRecord: CaseRecord) {
  return (caseRecord.checklist ?? []).filter((item) => item.status !== "OPTIONAL").length;
}

export function getMissingChecklistCount(caseRecord: CaseRecord) {
  const checklistItems = caseRecord.checklist ?? [];

  if (checklistItems.length) {
    return checklistItems.filter(
      (item) => item.status !== "OPTIONAL" && !isChecklistReady(item.status)
    ).length;
  }

  return caseRecord.status === "NEEDS_MORE_EVIDENCE" ? caseRecord._count?.checklist ?? 0 : 0;
}

export function getCaseCompleteness(caseRecord: CaseRecord): CaseCompleteness {
  const totalDocuments = caseRecord.documentStats?.total ?? caseRecord._count?.documents ?? 0;
  const processedDocuments = caseRecord.documentStats?.processed ?? 0;
  const failedDocuments = caseRecord.documentStats?.failed ?? 0;
  const eventCount = caseRecord.events?.length ?? caseRecord._count?.events ?? 0;
  const sourcedEventCount =
    caseRecord.events?.filter((event) => event.sources.length > 0).length ?? 0;
  const checklistItems = caseRecord.checklist ?? [];
  const statementCount = caseRecord._count?.statements ?? 0;
  const calculation = calculateCaseCompleteness({
    caseTypeName: caseRecord.caseType?.name,
    checklistStatuses: checklistItems.map((item) => item.status),
    eventCount,
    failedDocumentCount: failedDocuments,
    platform: caseRecord.platform,
    processedDocumentCount: processedDocuments,
    sourcedEventCount,
    statementCount,
    title: caseRecord.title,
    totalDocumentCount: totalDocuments
  });
  const completedChecklistItems = calculation.completedRequirementCount;
  const checklistItemCount = calculation.requiredChecklistCount;

  const criteria: CaseCompletenessCriterion[] = [
    createCompletenessCriterion({
      destinationId: "case-overview",
      detail:
        calculation.breakdown.caseDetails === caseCompletenessWeights.caseDetails
          ? "Case title, platform, and workflow are recorded."
          : "Add the missing core case details.",
      earned: calculation.breakdown.caseDetails,
      id: "case-details",
      label: "Case details",
      weight: caseCompletenessWeights.caseDetails
    }),
    createCompletenessCriterion({
      destinationId: "evidence-intake",
      detail: processedDocuments
        ? `${processedDocuments} processed ${processedDocuments === 1 ? "file is" : "files are"} reviewable.`
        : totalDocuments
          ? `${totalDocuments} ${totalDocuments === 1 ? "file is" : "files are"} still processing.`
          : "Add at least one reviewable evidence file.",
      earned: calculation.breakdown.evidence,
      id: "evidence",
      label: "Reviewable evidence",
      weight: caseCompletenessWeights.evidence
    }),
    createCompletenessCriterion({
      destinationId: "evidence-checklist",
      detail: checklistItemCount
        ? `${completedChecklistItems} of ${checklistItemCount} evidence requirements are covered.`
        : "Review the evidence checklist and match required proof.",
      earned: calculation.breakdown.requirements,
      id: "requirements",
      label: "Evidence requirements",
      weight: caseCompletenessWeights.requirements
    }),
    createCompletenessCriterion({
      destinationId: "case-timeline",
      detail: eventCount
        ? `${eventCount} dated ${eventCount === 1 ? "event" : "events"}; ${sourcedEventCount} linked to evidence.`
        : "Add the key dated events and link them to evidence.",
      earned: calculation.breakdown.timeline,
      id: "timeline",
      label: "Sourced timeline",
      weight: caseCompletenessWeights.timeline
    }),
    createCompletenessCriterion({
      destinationId: "statement-builder",
      detail: statementCount
        ? "An appeal statement draft is saved."
        : "Draft and save the appeal statement.",
      earned: calculation.breakdown.statement,
      id: "statement",
      label: "Appeal statement",
      weight: caseCompletenessWeights.statement
    })
  ];

  const capReasonMessages = {
    FAILED_EVIDENCE: "Resolve failed evidence processing before the case can pass 69%.",
    MISSING_REQUIREMENTS:
      "Cover every required checklist item before the case can pass 79%.",
    MISSING_STATEMENT: "Save an appeal statement before the case can pass 74%.",
    NO_REVIEWABLE_EVIDENCE:
      "A processed evidence file is required to pass 39%."
  } as const;

  return {
    capReasons: calculation.capReasons.map((reason) => capReasonMessages[reason]),
    criteria,
    rawScore: calculation.rawScore,
    score: calculation.score
  };
}

export function getCaseCompletenessScore(caseRecord: CaseRecord) {
  return getCaseCompleteness(caseRecord).score;
}

export function getCaseNextActions(caseRecord: CaseRecord): CaseNextAction[] {
  const completeness = getCaseCompletenessScore(caseRecord);
  const documentCount = caseRecord._count?.documents ?? 0;
  const eventCount = caseRecord.events?.length ?? caseRecord._count?.events ?? 0;
  const missingChecklistItems = getMissingChecklistCount(caseRecord);
  const hasStatement = Boolean(caseRecord._count?.statements);
  const submissionCount = caseRecord._count?.submissions ?? 0;
  const failedDocuments = caseRecord.documentStats?.failed ?? 0;

  const actions: CaseNextAction[] = [
    {
      destinationId: "proof-map",
      detail: "Inspect which appeal claims are supported, weak, or still missing source evidence.",
      label: "Review Proof Map",
      status: missingChecklistItems ? `${missingChecklistItems} gaps` : "Covered",
      variant: missingChecklistItems ? "warning" : "success"
    },
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
      status: completeness >= 80 ? "Ready" : `${completeness}% complete`,
      variant: completeness >= 80 ? "success" : "secondary",
      wide: true
    }
  ];

  if (
    submissionCount > 0 ||
    ["PACKET_GENERATED", "SUBMITTED", "RESOLVED"].includes(caseRecord.status)
  ) {
    actions.push({
      destinationId: "submission-tracker",
      detail: "Track delivery, platform responses, follow-ups, decisions, and later appeal rounds.",
      label: "Track submission",
      status: submissionCount
        ? `${submissionCount} ${submissionCount === 1 ? "round" : "rounds"}`
        : "Not recorded",
      variant:
        caseRecord.status === "RESOLVED"
          ? "success"
          : submissionCount
            ? "secondary"
            : "warning"
    });
  }

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
  return formatSharedCaseReference(caseRecord);
}

export function getCaseProgressMessage(completeness: number) {
  if (completeness >= 90) {
    return "Your packet is nearly ready for final review.";
  }

  if (completeness >= 60) {
    return "You are making progress. Close the remaining evidence gaps next.";
  }

  if (completeness >= 30) {
    return "The case is taking shape. Keep adding evidence and timeline details.";
  }

  return "Start with the strongest notice, support response, and account ownership proof.";
}

function createCompletenessCriterion(
  criterion: Omit<CaseCompletenessCriterion, "status">
): CaseCompletenessCriterion {
  return {
    ...criterion,
    status:
      criterion.earned === criterion.weight
        ? "complete"
        : criterion.earned === 0
          ? "missing"
          : "partial"
  };
}
