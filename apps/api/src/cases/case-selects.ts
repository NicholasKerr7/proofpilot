import { Prisma } from "@proofpilot/database";

/** Selects the public timeline event shape, including linked evidence labels. */
export const timelineEventSelect = {
  id: true,
  sortOrder: true,
  occurredAt: true,
  title: true,
  description: true,
  confidence: true,
  createdAt: true,
  updatedAt: true,
  sources: {
    select: {
      id: true,
      document: {
        select: {
          id: true,
          originalName: true
        }
      }
    }
  }
} satisfies Prisma.CaseEventSelect;

/** Applies the canonical user-defined timeline ordering. */
export const timelineQuery = {
  orderBy: [
    { sortOrder: "asc" },
    { occurredAt: "asc" },
    { id: "asc" }
  ],
  select: timelineEventSelect
} satisfies Prisma.CaseEventFindManyArgs;

/** Selects the checklist item and its strongest supporting evidence matches. */
export const checklistItemSelect = {
  id: true,
  label: true,
  description: true,
  status: true,
  manuallyCompletedAt: true,
  updatedAt: true,
  matches: {
    orderBy: { confidence: "desc" },
    take: 3,
    select: {
      id: true,
      confidence: true,
      rationale: true,
      document: {
        select: {
          id: true,
          originalName: true
        }
      }
    }
  }
} satisfies Prisma.CaseChecklistItemSelect;

/** Applies the stable checklist ordering used across case responses. */
export const checklistQuery = {
  orderBy: { createdAt: "asc" },
  select: checklistItemSelect
} satisfies Prisma.CaseChecklistItemFindManyArgs;

/** Selects a statement with its ten most recent recoverable versions. */
export const statementSelect = {
  id: true,
  caseId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  versions: {
    orderBy: { version: "desc" },
    select: {
      id: true,
      content: true,
      version: true,
      createdAt: true
    },
    take: 10
  }
} satisfies Prisma.CaseStatementSelect;

/** Selects all persisted statement-guidance fields. */
export const statementGuidanceSelect = {
  id: true,
  caseId: true,
  platformAction: true,
  actionDate: true,
  reasonGiven: true,
  accountUse: true,
  supportContact: true,
  requestedOutcome: true,
  supportingDocuments: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.StatementGuidanceSelect;

/** Selects the immutable case-summary history shape. */
export const caseSummarySelect = {
  id: true,
  caseId: true,
  content: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CaseSummarySelect;

/** Selects packet metadata and all generated exports newest first. */
export const packetSelect = {
  id: true,
  caseId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  exports: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      storageKey: true,
      byteSize: true,
      pageCount: true,
      includedDocumentCount: true,
      indexedDocumentCount: true,
      createdAt: true
    }
  }
} satisfies Prisma.CasePacketSelect;

export type PacketRecord = Prisma.CasePacketGetPayload<{
  select: typeof packetSelect;
}>;

export type StatementGuidanceRecord = Prisma.StatementGuidanceGetPayload<{
  select: typeof statementGuidanceSelect;
}>;
