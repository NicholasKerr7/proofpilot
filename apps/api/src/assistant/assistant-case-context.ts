import { ChecklistStatus, Prisma } from "@proofpilot/database";
import type {
  AssistantAction,
  AssistantCaseSummary
} from "@proofpilot/types";

export const assistantCaseSelect = {
  id: true,
  title: true,
  platform: true,
  status: true,
  summary: true,
  deadline: true,
  createdAt: true,
  documents: {
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      originalName: true,
      status: true
    }
  },
  events: {
    orderBy: { occurredAt: "asc" },
    take: 12,
    select: {
      id: true,
      occurredAt: true,
      title: true,
      description: true
    }
  },
  checklist: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      description: true,
      status: true
    }
  },
  statements: {
    orderBy: { updatedAt: "desc" },
    take: 1,
    select: {
      id: true,
      content: true,
      updatedAt: true
    }
  },
  _count: {
    select: {
      documents: true,
      events: true,
      checklist: true,
      statements: true
    }
  }
} satisfies Prisma.CaseSelect;

export type AssistantCaseContext = Prisma.CaseGetPayload<{
  select: typeof assistantCaseSelect;
}>;

const readyChecklistStatuses = new Set<ChecklistStatus>([
  ChecklistStatus.COMPLETE,
  ChecklistStatus.FOUND
]);

export function isAssistantChecklistReady(status: ChecklistStatus) {
  return readyChecklistStatuses.has(status);
}

export function getAssistantProgress(caseRecord: AssistantCaseContext) {
  const documentScore = Math.min(40, caseRecord._count.documents * 10);
  const eventScore = Math.min(25, caseRecord._count.events * 8);
  const checklistReady = caseRecord.checklist.filter((item) =>
    isAssistantChecklistReady(item.status)
  ).length;
  const checklistScore = caseRecord.checklist.length
    ? Math.round((checklistReady / caseRecord.checklist.length) * 25)
    : 0;
  const statementScore = caseRecord.summary || caseRecord._count.statements ? 10 : 0;

  return Math.min(100, documentScore + eventScore + checklistScore + statementScore);
}

export function toAssistantCaseSummary(
  caseRecord: AssistantCaseContext
): AssistantCaseSummary {
  return {
    checklistReady: caseRecord.checklist.filter((item) =>
      isAssistantChecklistReady(item.status)
    ).length,
    checklistTotal: caseRecord.checklist.length,
    createdAt: caseRecord.createdAt.toISOString(),
    deadline: caseRecord.deadline?.toISOString() ?? null,
    documentCount: caseRecord._count.documents,
    eventCount: caseRecord._count.events,
    id: caseRecord.id,
    platform: caseRecord.platform,
    progress: getAssistantProgress(caseRecord),
    statementCount: caseRecord._count.statements,
    status: caseRecord.status,
    summary: caseRecord.summary,
    title: caseRecord.title
  };
}

export function getAssistantNextActions(
  caseRecord: AssistantCaseContext
): AssistantAction[] {
  const missingChecklist = caseRecord.checklist.filter(
    (item) => !isAssistantChecklistReady(item.status)
  ).length;

  return [
    {
      destinationId: "evidence-intake",
      detail: caseRecord._count.documents
        ? "Review current files and add the strongest missing proof."
        : "Add the restriction notice, support messages, and ownership proof.",
      label: "Upload additional evidence",
      status: caseRecord._count.documents
        ? `${caseRecord._count.documents} files saved`
        : "No files saved"
    },
    {
      destinationId: "evidence-checklist",
      detail: missingChecklist
        ? "Resolve the requirements that do not have reliable evidence yet."
        : "Confirm every matched requirement before generating the packet.",
      label: "Complete pending checklist",
      status: missingChecklist ? `${missingChecklist} items remaining` : "Checklist ready"
    },
    {
      destinationId: "case-timeline",
      detail: caseRecord._count.events
        ? "Verify that each key event is accurate and complete."
        : "Add the notice, support contact, and appeal dates.",
      label: "Review timeline events",
      status: caseRecord._count.events
        ? `${caseRecord._count.events} events saved`
        : "Timeline is empty"
    }
  ];
}

export function getAssistantSuggestedPrompts(caseRecord: AssistantCaseContext) {
  return [
    "What evidence am I missing?",
    "Summarize my case",
    caseRecord._count.statements
      ? "Review my statement for clarity"
      : "Help me draft my statement",
    "What should I do next?"
  ];
}
