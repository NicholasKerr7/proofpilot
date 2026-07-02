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

interface GenerateStatementInput {
  title: string;
  platform: string;
  summary: string | null;
  deadline: Date | null;
  events: StatementEvent[];
  checklist: StatementChecklistItem[];
  documents: StatementDocument[];
}

const readyChecklistStatuses = new Set<ChecklistStatus>([
  ChecklistStatus.COMPLETE,
  ChecklistStatus.FOUND
]);

export function generateAppealStatement(input: GenerateStatementInput) {
  const sections = [
    `To the ${input.platform} Appeals Team,`,
    buildOpening(input),
    buildTimelineSection(input.events),
    buildEvidenceSection(input.documents, input.checklist),
    buildRequestedOutcome(input)
  ].filter(Boolean);

  return sections.join("\n\n");
}

function buildOpening(input: GenerateStatementInput) {
  const lines = [
    `I am requesting a review of the account action related to "${input.title}".`,
    input.summary?.trim() || "My goal is to provide a clear record of what happened and the evidence available for review."
  ];

  if (input.deadline) {
    lines.push(`I am trying to resolve this before ${formatDate(input.deadline)}.`);
  }

  return lines.join(" ");
}

function buildTimelineSection(events: StatementEvent[]) {
  if (!events.length) {
    return "Timeline\nI am still organizing the key dates and will update this statement as additional evidence is added.";
  }

  const lines = events.slice(0, 6).map((event) => {
    const description = event.description ? `: ${event.description}` : "";
    return `- ${formatDate(event.occurredAt)}: ${event.title}${description}`;
  });

  return ["Timeline", ...lines].join("\n");
}

function buildEvidenceSection(
  documents: StatementDocument[],
  checklist: StatementChecklistItem[]
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
  return [
    "Requested outcome",
    `Please review the attached evidence and reconsider the ${input.platform} account action.`,
    "I am asking for the restriction, hold, closure, or suspension to be removed, or for a specific explanation of what additional information is required."
  ].join("\n");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(value);
}
