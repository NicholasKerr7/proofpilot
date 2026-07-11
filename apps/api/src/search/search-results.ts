import { Prisma } from "@proofpilot/database";
import type {
  GlobalSearchResult,
  GlobalSearchSort
} from "@proofpilot/types";

export const caseSearchSelect = {
  id: true,
  title: true,
  platform: true,
  summary: true,
  status: true,
  updatedAt: true
} satisfies Prisma.CaseSelect;

export const documentSearchSelect = {
  id: true,
  originalName: true,
  extractedText: true,
  mimeType: true,
  byteSize: true,
  status: true,
  updatedAt: true,
  case: {
    select: {
      id: true,
      title: true,
      platform: true
    }
  }
} satisfies Prisma.DocumentSelect;

export const timelineSearchSelect = {
  id: true,
  title: true,
  description: true,
  occurredAt: true,
  case: {
    select: {
      id: true,
      title: true,
      platform: true
    }
  }
} satisfies Prisma.CaseEventSelect;

export const checklistSearchSelect = {
  id: true,
  label: true,
  description: true,
  status: true,
  updatedAt: true,
  case: {
    select: {
      id: true,
      title: true,
      platform: true
    }
  }
} satisfies Prisma.CaseChecklistItemSelect;

export const statementSearchSelect = {
  id: true,
  content: true,
  updatedAt: true,
  case: {
    select: {
      id: true,
      title: true,
      platform: true
    }
  }
} satisfies Prisma.CaseStatementSelect;

export const packetSearchSelect = {
  id: true,
  status: true,
  updatedAt: true,
  _count: {
    select: {
      exports: true
    }
  },
  case: {
    select: {
      id: true,
      title: true,
      platform: true
    }
  }
} satisfies Prisma.CasePacketSelect;

export const supportSearchSelect = {
  id: true,
  subject: true,
  message: true,
  status: true,
  updatedAt: true,
  case: {
    select: {
      id: true,
      title: true,
      platform: true
    }
  }
} satisfies Prisma.SupportRequestSelect;

export type CaseSearchRow = Prisma.CaseGetPayload<{ select: typeof caseSearchSelect }>;
export type DocumentSearchRow = Prisma.DocumentGetPayload<{ select: typeof documentSearchSelect }>;
export type TimelineSearchRow = Prisma.CaseEventGetPayload<{ select: typeof timelineSearchSelect }>;
export type ChecklistSearchRow = Prisma.CaseChecklistItemGetPayload<{
  select: typeof checklistSearchSelect;
}>;
export type StatementSearchRow = Prisma.CaseStatementGetPayload<{
  select: typeof statementSearchSelect;
}>;
export type PacketSearchRow = Prisma.CasePacketGetPayload<{ select: typeof packetSearchSelect }>;
export type SupportSearchRow = Prisma.SupportRequestGetPayload<{
  select: typeof supportSearchSelect;
}>;

export function toCaseSearchResult(row: CaseSearchRow, query: string): GlobalSearchResult {
  return {
    id: row.id,
    type: "CASE",
    title: row.title,
    excerpt: createExcerpt(row.summary, query, `${row.platform} appeal case`),
    caseId: row.id,
    caseTitle: row.title,
    platform: row.platform,
    status: row.status,
    date: row.updatedAt.toISOString()
  };
}

export function toDocumentSearchResult(
  row: DocumentSearchRow,
  query: string
): GlobalSearchResult {
  return {
    id: row.id,
    type: "DOCUMENT",
    title: row.originalName,
    excerpt: createExcerpt(row.extractedText, query, `Evidence in ${row.case.title}`),
    caseId: row.case.id,
    caseTitle: row.case.title,
    platform: row.case.platform,
    status: row.status,
    date: row.updatedAt.toISOString(),
    file: {
      mimeType: row.mimeType,
      byteSize: row.byteSize
    }
  };
}

export function toTimelineSearchResult(
  row: TimelineSearchRow,
  query: string
): GlobalSearchResult {
  return {
    id: row.id,
    type: "TIMELINE",
    title: row.title,
    excerpt: createExcerpt(row.description, query, `Timeline event in ${row.case.title}`),
    caseId: row.case.id,
    caseTitle: row.case.title,
    platform: row.case.platform,
    status: null,
    date: row.occurredAt.toISOString()
  };
}

export function toChecklistSearchResult(
  row: ChecklistSearchRow,
  query: string
): GlobalSearchResult {
  return {
    id: row.id,
    type: "CHECKLIST",
    title: row.label,
    excerpt: createExcerpt(row.description, query, `Checklist item in ${row.case.title}`),
    caseId: row.case.id,
    caseTitle: row.case.title,
    platform: row.case.platform,
    status: row.status,
    date: row.updatedAt.toISOString()
  };
}

export function toStatementSearchResult(
  row: StatementSearchRow,
  query: string
): GlobalSearchResult {
  return {
    id: row.id,
    type: "STATEMENT",
    title: `Statement for ${row.case.title}`,
    excerpt: createExcerpt(row.content, query, "Saved appeal statement"),
    caseId: row.case.id,
    caseTitle: row.case.title,
    platform: row.case.platform,
    status: null,
    date: row.updatedAt.toISOString()
  };
}

export function toPacketSearchResult(row: PacketSearchRow): GlobalSearchResult {
  const exportLabel = `${row._count.exports} ${row._count.exports === 1 ? "export" : "exports"}`;
  return {
    id: row.id,
    type: "PACKET",
    title: `${row.case.title} packet`,
    excerpt: `${row.case.platform} packet with ${exportLabel}`,
    caseId: row.case.id,
    caseTitle: row.case.title,
    platform: row.case.platform,
    status: row.status,
    date: row.updatedAt.toISOString()
  };
}

export function toSupportSearchResult(
  row: SupportSearchRow,
  query: string
): GlobalSearchResult {
  return {
    id: row.id,
    type: "SUPPORT",
    title: row.subject,
    excerpt: createExcerpt(row.message, query, "Support request"),
    caseId: row.case?.id ?? null,
    caseTitle: row.case?.title ?? null,
    platform: row.case?.platform ?? null,
    status: row.status,
    date: row.updatedAt.toISOString()
  };
}

export function sortSearchResults(
  results: GlobalSearchResult[],
  sort: GlobalSearchSort,
  query: string
) {
  return [...results].sort((left, right) => {
    if (sort === "OLDEST") {
      return Date.parse(left.date) - Date.parse(right.date);
    }

    if (sort === "RELEVANCE" && query) {
      const scoreDifference = getRelevanceScore(right, query) - getRelevanceScore(left, query);

      if (scoreDifference) {
        return scoreDifference;
      }
    }

    return Date.parse(right.date) - Date.parse(left.date);
  });
}

function createExcerpt(value: string | null, query: string, fallback: string) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallback;
  }

  const maxLength = 180;
  const queryIndex = query ? normalized.toLowerCase().indexOf(query.toLowerCase()) : -1;
  const start = queryIndex > 55 ? queryIndex - 45 : 0;
  const excerpt = normalized.slice(start, start + maxLength).trim();
  return `${start ? "..." : ""}${excerpt}${start + maxLength < normalized.length ? "..." : ""}`;
}

function getRelevanceScore(result: GlobalSearchResult, query: string) {
  const normalizedQuery = query.toLowerCase();
  const title = result.title.toLowerCase();
  const excerpt = result.excerpt.toLowerCase();
  let score = 0;

  if (title === normalizedQuery) score += 12;
  if (title.startsWith(normalizedQuery)) score += 8;
  if (title.includes(normalizedQuery)) score += 5;
  if (excerpt.includes(normalizedQuery)) score += 2;
  return score;
}
