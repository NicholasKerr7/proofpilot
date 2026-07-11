import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  globalSearchResultTypes,
  globalSearchSortOptions,
  globalSearchStatusFilters,
  type GlobalSearchResponse,
  type GlobalSearchResult,
  type GlobalSearchResultType,
  type GlobalSearchSort,
  type GlobalSearchStatusFilter
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import type { GlobalSearchQueryDto } from "./dto/global-search-query.dto.js";
import { buildSearchWheres, isTypeAvailableForStatus } from "./search-query-builders.js";
import {
  caseSearchSelect,
  checklistSearchSelect,
  documentSearchSelect,
  packetSearchSelect,
  sortSearchResults,
  statementSearchSelect,
  supportSearchSelect,
  timelineSearchSelect,
  toCaseSearchResult,
  toChecklistSearchResult,
  toDocumentSearchResult,
  toPacketSearchResult,
  toStatementSearchResult,
  toSupportSearchResult,
  toTimelineSearchResult
} from "./search-results.js";

const defaultPerTypeLimit = 8;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(ownerId: string, query: GlobalSearchQueryDto): Promise<GlobalSearchResponse> {
    const normalizedQuery = query.q?.trim() ?? "";
    const includeArchived = this.parseIncludeArchived(query.includeArchived);
    const status = this.parseStatus(query.status);
    const sort = this.parseSort(query.sort);
    const selectedTypes = this.parseTypes(query.types).filter((type) =>
      isTypeAvailableForStatus(type, status)
    );
    const perTypeLimit = this.parseLimit(query.limit);

    if (normalizedQuery.length > 160) {
      throw new BadRequestException("Search query is too long.");
    }

    this.validateDateRange(query.from, query.to);

    const selectedCase = query.caseId
      ? await this.prisma.case.findFirst({
          where: {
            id: query.caseId,
            ownerId,
            ...(includeArchived ? {} : { archivedAt: null })
          },
          select: {
            id: true,
            title: true
          }
        })
      : null;

    if (query.caseId && !selectedCase) {
      throw new NotFoundException("Case not found.");
    }

    const wheres = buildSearchWheres(ownerId, {
      ...(query.caseId ? { caseId: query.caseId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      includeArchived,
      query: normalizedQuery,
      status
    });
    const activeTypes = new Set(selectedTypes);
    const direction = sort === "OLDEST" ? "asc" : "desc";
    const take = perTypeLimit + 1;

    const [cases, documents, timeline, checklist, statements, packets, support] =
      await Promise.all([
        activeTypes.has("CASE")
          ? this.prisma.case.findMany({
              where: wheres.cases,
              orderBy: { updatedAt: direction },
              select: caseSearchSelect,
              take
            })
          : [],
        activeTypes.has("DOCUMENT")
          ? this.prisma.document.findMany({
              where: wheres.documents,
              orderBy: { updatedAt: direction },
              select: documentSearchSelect,
              take
            })
          : [],
        activeTypes.has("TIMELINE")
          ? this.prisma.caseEvent.findMany({
              where: wheres.timeline,
              orderBy: { occurredAt: direction },
              select: timelineSearchSelect,
              take
            })
          : [],
        activeTypes.has("CHECKLIST")
          ? this.prisma.caseChecklistItem.findMany({
              where: wheres.checklist,
              orderBy: { updatedAt: direction },
              select: checklistSearchSelect,
              take
            })
          : [],
        activeTypes.has("STATEMENT")
          ? this.prisma.caseStatement.findMany({
              where: wheres.statements,
              orderBy: { updatedAt: direction },
              select: statementSearchSelect,
              take
            })
          : [],
        activeTypes.has("PACKET")
          ? this.prisma.casePacket.findMany({
              where: wheres.packets,
              orderBy: { updatedAt: direction },
              select: packetSearchSelect,
              take
            })
          : [],
        activeTypes.has("SUPPORT")
          ? this.prisma.supportRequest.findMany({
              where: wheres.support,
              orderBy: { updatedAt: direction },
              select: supportSearchSelect,
              take
            })
          : []
      ]);

    const groups = [
      createGroup(
        "CASE",
        cases,
        (row) => toCaseSearchResult(row, normalizedQuery),
        perTypeLimit
      ),
      createGroup(
        "DOCUMENT",
        documents,
        (row) => toDocumentSearchResult(row, normalizedQuery),
        perTypeLimit
      ),
      createGroup(
        "TIMELINE",
        timeline,
        (row) => toTimelineSearchResult(row, normalizedQuery),
        perTypeLimit
      ),
      createGroup(
        "CHECKLIST",
        checklist,
        (row) => toChecklistSearchResult(row, normalizedQuery),
        perTypeLimit
      ),
      createGroup(
        "STATEMENT",
        statements,
        (row) => toStatementSearchResult(row, normalizedQuery),
        perTypeLimit
      ),
      createGroup("PACKET", packets, toPacketSearchResult, perTypeLimit),
      createGroup(
        "SUPPORT",
        support,
        (row) => toSupportSearchResult(row, normalizedQuery),
        perTypeLimit
      )
    ];
    const counts = createEmptyCounts();
    const hasMore: GlobalSearchResultType[] = [];

    for (const group of groups) {
      counts[group.type] = group.results.length;
      if (group.hasMore) hasMore.push(group.type);
    }

    const results = sortSearchResults(
      groups.flatMap((group) => group.results),
      sort,
      normalizedQuery
    );

    return {
      generatedAt: new Date().toISOString(),
      query: normalizedQuery,
      scope: {
        caseId: selectedCase?.id ?? null,
        label: selectedCase?.title ?? "All cases"
      },
      counts,
      hasMore,
      total: results.length,
      results
    };
  }

  private parseTypes(value?: string): GlobalSearchResultType[] {
    if (!value) {
      return [...globalSearchResultTypes];
    }

    const types = [...new Set(value.split(","))];
    const invalidType = types.find(
      (type) => !globalSearchResultTypes.includes(type as GlobalSearchResultType)
    );

    if (invalidType) {
      throw new BadRequestException("Search result type is invalid.");
    }

    return types as GlobalSearchResultType[];
  }

  private parseStatus(value?: GlobalSearchStatusFilter) {
    const status = value ?? "ALL";

    if (!globalSearchStatusFilters.includes(status)) {
      throw new BadRequestException("Search status filter is invalid.");
    }

    return status;
  }

  private parseSort(value?: GlobalSearchSort) {
    const sort = value ?? "RELEVANCE";

    if (!globalSearchSortOptions.includes(sort)) {
      throw new BadRequestException("Search sort option is invalid.");
    }

    return sort;
  }

  private parseIncludeArchived(value?: string) {
    if (value !== undefined && value !== "true" && value !== "false") {
      throw new BadRequestException("Archived search filter is invalid.");
    }

    return value === "true";
  }

  private parseLimit(value?: number) {
    const limit = value ?? defaultPerTypeLimit;

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException("Search result limit must be between 1 and 50.");
    }

    return limit;
  }

  private validateDateRange(from?: string, to?: string) {
    if ((from && !isValidSearchDate(from)) || (to && !isValidSearchDate(to))) {
      throw new BadRequestException("Search dates must be valid dates in YYYY-MM-DD format.");
    }

    if (from && to && from > to) {
      throw new BadRequestException("Search start date must be on or before the end date.");
    }
  }
}

function createGroup<T>(
  type: GlobalSearchResultType,
  rows: T[],
  mapRow: (row: T) => GlobalSearchResult,
  limit: number
) {
  return {
    type,
    hasMore: rows.length > limit,
    results: rows.slice(0, limit).map(mapRow)
  };
}

function createEmptyCounts() {
  return Object.fromEntries(
    globalSearchResultTypes.map((type) => [type, 0])
  ) as Record<GlobalSearchResultType, number>;
}

function isValidSearchDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
