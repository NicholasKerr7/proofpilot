export const globalSearchResultTypes = [
  "CASE",
  "DOCUMENT",
  "TIMELINE",
  "CHECKLIST",
  "STATEMENT",
  "PACKET",
  "SUPPORT"
] as const;

export type GlobalSearchResultType = (typeof globalSearchResultTypes)[number];

export const globalSearchStatusFilters = [
  "ALL",
  "NEEDS_ATTENTION",
  "IN_PROGRESS",
  "READY",
  "COMPLETE"
] as const;

export type GlobalSearchStatusFilter = (typeof globalSearchStatusFilters)[number];

export const globalSearchSortOptions = ["RELEVANCE", "NEWEST", "OLDEST"] as const;
export type GlobalSearchSort = (typeof globalSearchSortOptions)[number];

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  excerpt: string;
  caseId: string | null;
  caseTitle: string | null;
  platform: string | null;
  status: string | null;
  date: string;
  file?: {
    mimeType: string;
    byteSize: number;
  };
}

export interface GlobalSearchResponse {
  generatedAt: string;
  query: string;
  scope: {
    caseId: string | null;
    label: string;
  };
  counts: Record<GlobalSearchResultType, number>;
  hasMore: GlobalSearchResultType[];
  total: number;
  results: GlobalSearchResult[];
}
