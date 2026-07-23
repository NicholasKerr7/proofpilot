export const caseCompletenessWeights = {
  caseDetails: 10,
  evidence: 20,
  requirements: 30,
  statement: 20,
  timeline: 20
} as const;

export type CaseCompletenessCapReason =
  | "FAILED_EVIDENCE"
  | "MISSING_REQUIREMENTS"
  | "MISSING_STATEMENT"
  | "NO_REVIEWABLE_EVIDENCE";

export interface CaseCompletenessInput {
  caseTypeName?: string | null;
  checklistStatuses: string[];
  eventCount: number;
  failedDocumentCount: number;
  platform?: string | null;
  processedDocumentCount: number;
  sourcedEventCount: number;
  statementCount: number;
  title?: string | null;
  totalDocumentCount: number;
}

export interface CaseCompletenessResult {
  breakdown: {
    caseDetails: number;
    evidence: number;
    requirements: number;
    statement: number;
    timeline: number;
  };
  capReasons: CaseCompletenessCapReason[];
  completedRequirementCount: number;
  missingRequirementCount: number;
  rawScore: number;
  requiredChecklistCount: number;
  score: number;
}

export function calculateCaseCompleteness(
  input: CaseCompletenessInput
): CaseCompletenessResult {
  const coreDetails = [input.title, input.platform, input.caseTypeName];
  const caseDetails = Math.round(
    (coreDetails.filter(isPresent).length / coreDetails.length) *
      caseCompletenessWeights.caseDetails
  );
  const evidence =
    input.processedDocumentCount > 0
      ? caseCompletenessWeights.evidence
      : input.totalDocumentCount > 0
        ? 8
        : 0;
  const requiredStatuses = input.checklistStatuses.filter(
    (status) => status !== "OPTIONAL"
  );
  const completedRequirementCount = requiredStatuses.filter(
    isCompleteChecklistStatus
  ).length;
  const requiredChecklistCount = requiredStatuses.length;
  const requirements = requiredChecklistCount
    ? Math.round(
        (completedRequirementCount / requiredChecklistCount) *
          caseCompletenessWeights.requirements
      )
    : 0;
  const timeline =
    Math.round(Math.min(1, input.eventCount / 2) * 15) +
    (input.sourcedEventCount > 0 ? 5 : 0);
  const statement =
    input.statementCount > 0 ? caseCompletenessWeights.statement : 0;
  const breakdown = {
    caseDetails,
    evidence,
    requirements,
    statement,
    timeline
  };
  const rawScore = Object.values(breakdown).reduce(
    (total, value) => total + value,
    0
  );
  const missingRequirementCount = Math.max(
    0,
    requiredChecklistCount - completedRequirementCount
  );
  const capReasons: CaseCompletenessCapReason[] = [
    ...(input.processedDocumentCount === 0
      ? (["NO_REVIEWABLE_EVIDENCE"] as const)
      : []),
    ...(input.failedDocumentCount > 0
      ? (["FAILED_EVIDENCE"] as const)
      : []),
    ...(missingRequirementCount > 0
      ? (["MISSING_REQUIREMENTS"] as const)
      : []),
    ...(input.statementCount === 0
      ? (["MISSING_STATEMENT"] as const)
      : [])
  ];
  const scoreCaps = [
    input.processedDocumentCount === 0 ? 39 : 100,
    input.failedDocumentCount > 0 ? 69 : 100,
    missingRequirementCount > 0 ? 79 : 100,
    input.statementCount === 0 ? 74 : 100
  ];

  return {
    breakdown,
    capReasons,
    completedRequirementCount,
    missingRequirementCount,
    rawScore,
    requiredChecklistCount,
    score: Math.min(rawScore, ...scoreCaps)
  };
}

function isCompleteChecklistStatus(status: string) {
  return status === "COMPLETE" || status === "FOUND";
}

function isPresent(value: string | null | undefined) {
  return Boolean(value?.trim());
}
