import { ChecklistStatus } from "@proofpilot/database";

interface StatementEvent {
  occurredAt: Date;
  title: string;
  description: string | null;
}

interface StatementChecklistItem {
  label: string;
  status: ChecklistStatus;
}

interface StatementDocument {
  originalName: string;
  status: string;
}

interface StatementGuidance {
  platformAction: string | null;
  actionDate: string | null;
  reasonGiven: string | null;
  accountUse: string | null;
  supportContact: string | null;
  requestedOutcome: string | null;
  supportingDocuments: string | null;
}

interface GenerateStatementInput {
  title: string;
  platform: string;
  summary: string | null;
  deadline: Date | null;
  events: StatementEvent[];
  checklist: StatementChecklistItem[];
  documents: StatementDocument[];
  guidance: StatementGuidance | null;
}

const readyChecklistStatuses = new Set<ChecklistStatus>([
  ChecklistStatus.COMPLETE,
  ChecklistStatus.FOUND
]);
const maxStatementLength = 12000;

export function generateAppealStatement(input: GenerateStatementInput) {
  const sections = [
    `To the ${input.platform} Appeals Team,`,
    buildOpening(input),
    buildTimelineSection(input.events, input.guidance?.actionDate ?? null),
    buildContextSection(input.guidance),
    buildEvidenceSection(
      input.documents,
      input.checklist,
      input.guidance?.supportingDocuments ?? null
    ),
    buildRequestedOutcome(input)
  ].filter(Boolean);

  return limitLength(sections.join("\n\n"), maxStatementLength);
}

function buildOpening(input: GenerateStatementInput) {
  const platformAction = normalizeAnswer(input.guidance?.platformAction);
  const reasonGiven = normalizeAnswer(input.guidance?.reasonGiven);
  const lines = [
    platformAction
      ? ensureSentence(platformAction)
      : `I am requesting a review of the account action related to "${input.title}".`,
    input.summary?.trim() || "My goal is to provide a clear record of what happened and the evidence available for review."
  ];

  if (reasonGiven) {
    lines.push(`The reason communicated to me was: ${ensureSentence(reasonGiven)}`);
  }

  if (input.deadline) {
    lines.push(`I am trying to resolve this before ${formatDate(input.deadline)}.`);
  }

  return lines.join(" ");
}

function buildTimelineSection(events: StatementEvent[], actionDate: string | null) {
  if (!events.length) {
    const dateAnswer = normalizeAnswer(actionDate);
    return dateAnswer
      ? `Timeline\n- Account action: ${ensureSentence(dateAnswer)}`
      : "Timeline\nI am still organizing the key dates and will update this statement as additional evidence is added.";
  }

  const lines = events.slice(0, 6).map((event) => {
    const description = event.description ? `: ${event.description}` : "";
    return `- ${formatDate(event.occurredAt)}: ${event.title}${description}`;
  });

  return ["Timeline", ...lines].join("\n");
}

function buildContextSection(guidance: StatementGuidance | null) {
  const accountUse = normalizeAnswer(guidance?.accountUse);
  const supportContact = normalizeAnswer(guidance?.supportContact);

  if (!accountUse && !supportContact) {
    return null;
  }

  const lines = ["Account context"];

  if (accountUse) {
    lines.push(`- Account use: ${ensureSentence(accountUse)}`);
  }

  if (supportContact) {
    lines.push(`- Support contact: ${ensureSentence(supportContact)}`);
  }

  return lines.join("\n");
}

function buildEvidenceSection(
  documents: StatementDocument[],
  checklist: StatementChecklistItem[],
  supportingDocuments: string | null
) {
  const readyItems = checklist
    .filter((item) => readyChecklistStatuses.has(item.status))
    .map((item) => item.label);
  const missingItems = checklist
    .filter((item) => item.status === ChecklistStatus.MISSING)
    .map((item) => item.label);
  const processedDocuments = documents
    .filter((document) => document.status === "PROCESSED" || document.status === "NEEDS_REVIEW")
    .map((document) => document.originalName);

  const lines = ["Evidence available for review"];

  const documentAnswer = normalizeAnswer(supportingDocuments);
  if (documentAnswer) {
    lines.push(`- Supporting context: ${ensureSentence(documentAnswer)}`);
  }

  if (readyItems.length) {
    lines.push(`- Matched requirements: ${readyItems.slice(0, 6).join("; ")}.`);
  }

  if (processedDocuments.length) {
    lines.push(`- Supporting files: ${processedDocuments.slice(0, 8).join("; ")}.`);
  }

  if (missingItems.length) {
    lines.push(`- Items still being gathered: ${missingItems.slice(0, 4).join("; ")}.`);
  }

  if (lines.length === 1) {
    lines.push("- Evidence is being collected and will be attached to the packet.");
  }

  return lines.join("\n");
}

function buildRequestedOutcome(input: GenerateStatementInput) {
  const requestedOutcome = normalizeAnswer(input.guidance?.requestedOutcome);

  return [
    "Requested outcome",
    requestedOutcome
      ? ensureSentence(requestedOutcome)
      : `Please review the attached evidence and reconsider the ${input.platform} account action.`,
    "If additional information is required, please identify the specific records or steps needed to complete the review."
  ].join("\n");
}

function normalizeAnswer(value: string | null | undefined) {
  return value?.trim() || null;
}

function ensureSentence(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function limitLength(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(value);
}
