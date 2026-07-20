import { ChecklistStatus } from "@proofpilot/database";

interface SummaryEvent {
  occurredAt: Date;
  title: string;
}

interface SummaryChecklistItem {
  label: string;
  status: ChecklistStatus;
  requirement: {
    required: boolean;
  } | null;
}

interface SummaryDocument {
  originalName: string;
  status: string;
}

interface GenerateCaseSummaryInput {
  title: string;
  platform: string;
  events: SummaryEvent[];
  checklist: SummaryChecklistItem[];
  documents: SummaryDocument[];
  statement: string | null;
  requestedOutcome: string | null;
}

const coveredStatuses = new Set<ChecklistStatus>([
  ChecklistStatus.COMPLETE,
  ChecklistStatus.FOUND
]);
const maxSummaryLength = 2000;

export function generateCaseSummary(input: GenerateCaseSummaryInput) {
  const sections = [
    `This case concerns "${input.title}", a ${input.platform} account appeal.`,
    summarizeTimeline(input.events),
    summarizeEvidence(input.documents, input.checklist),
    summarizeStatement(input.statement, input.requestedOutcome)
  ].filter(Boolean);

  return limitLength(sections.join(" "), maxSummaryLength);
}

function summarizeTimeline(events: SummaryEvent[]) {
  if (!events.length) {
    return "No timeline events have been confirmed yet.";
  }

  const firstEvent = events[0];
  const lastEvent = events.at(-1);

  if (!firstEvent || !lastEvent) {
    return null;
  }

  if (events.length === 1) {
    return `The timeline currently records one event on ${formatDate(firstEvent.occurredAt)}: "${ensureSentence(firstEvent.title)}"`;
  }

  return `The timeline contains ${events.length} events from ${formatDate(firstEvent.occurredAt)} ("${firstEvent.title}") through ${formatDate(lastEvent.occurredAt)} ("${lastEvent.title}").`;
}

function summarizeEvidence(
  documents: SummaryDocument[],
  checklist: SummaryChecklistItem[]
) {
  const reviewableDocuments = documents.filter(
    (document) => document.status === "PROCESSED" || document.status === "NEEDS_REVIEW"
  );
  const requiredItems = checklist.filter((item) => item.requirement?.required !== false);
  const coveredItems = requiredItems.filter((item) => coveredStatuses.has(item.status));
  const missingItems = requiredItems.filter((item) => item.status === ChecklistStatus.MISSING);
  const parts = [
    reviewableDocuments.length
      ? `The evidence record contains ${reviewableDocuments.length} reviewable file${reviewableDocuments.length === 1 ? "" : "s"}${formatFileExamples(reviewableDocuments)}.`
      : "No processed evidence files are available yet."
  ];

  if (requiredItems.length) {
    parts.push(
      `Checklist review covers ${coveredItems.length} of ${requiredItems.length} required evidence item${requiredItems.length === 1 ? "" : "s"}${formatMissingItems(missingItems)}.`
    );
  }

  return parts.join(" ");
}

function summarizeStatement(statement: string | null, requestedOutcome: string | null) {
  const outcome = requestedOutcome?.trim();

  if (outcome) {
    return `The requested outcome is: ${ensureSentence(outcome)}`;
  }

  return statement?.trim()
    ? "A saved appeal statement is ready for final review."
    : "An appeal statement has not been saved yet.";
}

function formatFileExamples(documents: SummaryDocument[]) {
  const names = documents.slice(0, 3).map((document) => document.originalName);
  return names.length ? `, including ${names.join(", ")}` : "";
}

function formatMissingItems(items: SummaryChecklistItem[]) {
  const labels = items.slice(0, 3).map((item) => item.label);
  return labels.length ? `; outstanding items include ${labels.join(", ")}` : "";
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
