import {
  globalSearchResultTypes,
  type GlobalSearchResultType,
  type GlobalSearchSort,
  type GlobalSearchStatusFilter
} from "@proofpilot/types";

export interface SearchFiltersState {
  caseId: string | null;
  types: GlobalSearchResultType[];
  status: GlobalSearchStatusFilter;
  from: string;
  to: string;
  sort: GlobalSearchSort;
  includeArchived: boolean;
}

export function createDefaultSearchFilters(): SearchFiltersState {
  return {
    caseId: null,
    types: [...globalSearchResultTypes],
    status: "ALL",
    from: "",
    to: "",
    sort: "RELEVANCE",
    includeArchived: false
  };
}

export function buildSearchParams(query: string, filters: SearchFiltersState, limit: number) {
  const params = new URLSearchParams({
    types: filters.types.join(","),
    status: filters.status,
    sort: filters.sort,
    includeArchived: String(filters.includeArchived),
    limit: String(limit)
  });

  if (query) params.set("q", query);
  if (filters.caseId) params.set("caseId", filters.caseId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

export function countActiveSearchFilters(filters: SearchFiltersState) {
  let count = 0;
  const defaultTypes =
    filters.status === "ALL"
      ? globalSearchResultTypes
      : globalSearchResultTypes.filter(
          (type) => type !== "TIMELINE" && type !== "STATEMENT"
        );
  if (filters.caseId) count += 1;
  if (
    filters.types.length !== defaultTypes.length ||
    defaultTypes.some((type) => !filters.types.includes(type))
  ) {
    count += 1;
  }
  if (filters.status !== "ALL") count += 1;
  if (filters.from || filters.to) count += 1;
  if (filters.sort !== "RELEVANCE") count += 1;
  if (filters.includeArchived) count += 1;
  return count;
}
