import {
  CaseStatus,
  ChecklistStatus,
  DocumentStatus,
  PacketStatus,
  Prisma,
  SupportRequestStatus
} from "@proofpilot/database";
import type {
  GlobalSearchResultType,
  GlobalSearchStatusFilter
} from "@proofpilot/types";

export interface SearchFilters {
  caseId?: string;
  from?: string;
  includeArchived: boolean;
  query: string;
  status: GlobalSearchStatusFilter;
  to?: string;
}

export function buildSearchWheres(ownerId: string, filters: SearchFilters) {
  const caseScope: Prisma.CaseWhereInput = {
    ownerId,
    ...(filters.caseId ? { id: filters.caseId } : {}),
    ...(filters.includeArchived ? {} : { archivedAt: null })
  };
  const caseTextScope = addCaseTextSearch(caseScope, filters.query);
  const dateFilter = createDateFilter(filters.from, filters.to);
  const query = filters.query;

  const cases: Prisma.CaseWhereInput = {
    ...caseTextScope,
    ...(dateFilter ? { updatedAt: dateFilter } : {}),
    ...getCaseStatusWhere(filters.status)
  };

  const documents: Prisma.DocumentWhereInput = {
    case: caseScope,
    ...(dateFilter ? { updatedAt: dateFilter } : {}),
    ...getDocumentStatusWhere(filters.status),
    ...(query
      ? {
          OR: [
            { originalName: textContains(query) },
            { extractedText: textContains(query) },
            { case: caseTextScope }
          ]
        }
      : {})
  };

  const timeline: Prisma.CaseEventWhereInput = {
    case: caseScope,
    ...(dateFilter ? { occurredAt: dateFilter } : {}),
    ...(query
      ? {
          OR: [
            { title: textContains(query) },
            { description: textContains(query) },
            { case: caseTextScope }
          ]
        }
      : {})
  };

  const checklist: Prisma.CaseChecklistItemWhereInput = {
    case: caseScope,
    ...(dateFilter ? { updatedAt: dateFilter } : {}),
    ...getChecklistStatusWhere(filters.status),
    ...(query
      ? {
          OR: [
            { label: textContains(query) },
            { description: textContains(query) },
            { case: caseTextScope }
          ]
        }
      : {})
  };

  const statements: Prisma.CaseStatementWhereInput = {
    case: caseScope,
    ...(dateFilter ? { updatedAt: dateFilter } : {}),
    ...(query
      ? {
          OR: [{ content: textContains(query) }, { case: caseTextScope }]
        }
      : {})
  };

  const packets: Prisma.CasePacketWhereInput = {
    case: caseTextScope,
    ...(dateFilter ? { updatedAt: dateFilter } : {}),
    ...getPacketStatusWhere(filters.status)
  };

  const support: Prisma.SupportRequestWhereInput = {
    userId: ownerId,
    ...(filters.caseId ? { caseId: filters.caseId } : {}),
    ...(!filters.includeArchived && !filters.caseId
      ? {
          OR: [{ caseId: null }, { case: { archivedAt: null } }]
        }
      : {}),
    ...(dateFilter ? { updatedAt: dateFilter } : {}),
    ...getSupportStatusWhere(filters.status),
    ...(query
      ? {
          AND: [
            {
              OR: [
                { subject: textContains(query) },
                { message: textContains(query) },
                { case: caseTextScope }
              ]
            }
          ]
        }
      : {})
  };

  return { cases, documents, timeline, checklist, statements, packets, support };
}

export function isTypeAvailableForStatus(
  type: GlobalSearchResultType,
  status: GlobalSearchStatusFilter
) {
  return status === "ALL" || (type !== "TIMELINE" && type !== "STATEMENT");
}

function addCaseTextSearch(caseScope: Prisma.CaseWhereInput, query: string) {
  if (!query) {
    return caseScope;
  }

  return {
    ...caseScope,
    OR: [
      { title: textContains(query) },
      { platform: textContains(query) },
      { summary: textContains(query) }
    ]
  } satisfies Prisma.CaseWhereInput;
}

function textContains(value: string): Prisma.StringFilter {
  return {
    contains: value,
    mode: "insensitive"
  };
}

function createDateFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }

  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
  };
}

function getCaseStatusWhere(status: GlobalSearchStatusFilter): Prisma.CaseWhereInput {
  const statuses: Partial<Record<GlobalSearchStatusFilter, CaseStatus[]>> = {
    NEEDS_ATTENTION: [CaseStatus.NEEDS_MORE_EVIDENCE],
    IN_PROGRESS: [CaseStatus.DRAFT, CaseStatus.COLLECTING_EVIDENCE, CaseStatus.PROCESSING],
    READY: [CaseStatus.READY_FOR_REVIEW, CaseStatus.PACKET_GENERATED],
    COMPLETE: [CaseStatus.SUBMITTED, CaseStatus.RESOLVED]
  };
  return statuses[status] ? { status: { in: statuses[status] } } : {};
}

function getDocumentStatusWhere(status: GlobalSearchStatusFilter): Prisma.DocumentWhereInput {
  const statuses: Partial<Record<GlobalSearchStatusFilter, DocumentStatus[]>> = {
    NEEDS_ATTENTION: [DocumentStatus.FAILED, DocumentStatus.NEEDS_REVIEW],
    IN_PROGRESS: [DocumentStatus.UPLOADED, DocumentStatus.PROCESSING],
    READY: [DocumentStatus.PROCESSED],
    COMPLETE: []
  };
  return statuses[status] ? { status: { in: statuses[status] } } : {};
}

function getChecklistStatusWhere(status: GlobalSearchStatusFilter): Prisma.CaseChecklistItemWhereInput {
  const statuses: Partial<Record<GlobalSearchStatusFilter, ChecklistStatus[]>> = {
    NEEDS_ATTENTION: [ChecklistStatus.MISSING, ChecklistStatus.NEEDS_REVIEW],
    IN_PROGRESS: [ChecklistStatus.OPTIONAL],
    READY: [ChecklistStatus.FOUND],
    COMPLETE: [ChecklistStatus.COMPLETE]
  };
  return statuses[status] ? { status: { in: statuses[status] } } : {};
}

function getPacketStatusWhere(status: GlobalSearchStatusFilter): Prisma.CasePacketWhereInput {
  const statuses: Partial<Record<GlobalSearchStatusFilter, PacketStatus[]>> = {
    NEEDS_ATTENTION: [PacketStatus.FAILED],
    IN_PROGRESS: [PacketStatus.NOT_STARTED, PacketStatus.GENERATING],
    READY: [PacketStatus.READY],
    COMPLETE: [PacketStatus.DOWNLOADED]
  };
  return statuses[status] ? { status: { in: statuses[status] } } : {};
}

function getSupportStatusWhere(status: GlobalSearchStatusFilter): Prisma.SupportRequestWhereInput {
  const statuses: Partial<Record<GlobalSearchStatusFilter, SupportRequestStatus[]>> = {
    NEEDS_ATTENTION: [SupportRequestStatus.OPEN],
    IN_PROGRESS: [SupportRequestStatus.IN_PROGRESS],
    READY: [],
    COMPLETE: [SupportRequestStatus.RESOLVED]
  };
  return statuses[status] ? { status: { in: statuses[status] } } : {};
}
