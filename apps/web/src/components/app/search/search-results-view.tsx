import { ChevronRight, SearchX } from "lucide-react";
import {
  globalSearchResultTypes,
  type GlobalSearchResponse,
  type GlobalSearchResult,
  type GlobalSearchResultType
} from "@proofpilot/types";
import {
  formatSearchBytes,
  formatSearchDate,
  formatSearchStatus,
  searchTypeConfig
} from "@/components/app/search/search-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SearchResultTab = "ALL" | GlobalSearchResultType;

interface SearchResultsViewProps {
  activeTab: SearchResultTab;
  canLoadMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onOpenResult: (result: GlobalSearchResult) => void;
  onTabChange: (tab: SearchResultTab) => void;
  response: GlobalSearchResponse;
}

export function SearchResultsView({
  activeTab,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
  onOpenResult,
  onTabChange,
  response
}: SearchResultsViewProps) {
  const visibleResults =
    activeTab === "ALL"
      ? response.results
      : response.results.filter((result) => result.type === activeTab);
  const visibleTypes =
    activeTab === "ALL" ? globalSearchResultTypes : ([activeTab] as GlobalSearchResultType[]);
  const visibleHasMore =
    activeTab === "ALL" ? response.hasMore.length > 0 : response.hasMore.includes(activeTab);

  return (
    <div className="grid gap-5">
      <div
        aria-label="Search result types"
        className="flex gap-2 overflow-x-auto pb-1 [overscroll-behavior-x:contain] [-webkit-overflow-scrolling:touch]"
        role="tablist"
      >
        <ResultTab
          active={activeTab === "ALL"}
          count={response.total}
          hasMore={response.hasMore.length > 0}
          label="All"
          onClick={() => onTabChange("ALL")}
        />
        {globalSearchResultTypes.map((type) => (
          <ResultTab
            active={activeTab === type}
            count={response.counts[type]}
            hasMore={response.hasMore.includes(type)}
            key={type}
            label={searchTypeConfig[type].pluralLabel}
            onClick={() => onTabChange(type)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {response.query ? `Results for “${response.query}”` : "Recent workspace results"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing {visibleResults.length}
            {visibleHasMore ? "+" : ""} {visibleResults.length === 1 ? "result" : "results"} in {response.scope.label}
          </p>
        </div>
        <Badge variant="secondary">{response.scope.label}</Badge>
      </div>

      {visibleResults.length ? (
        <div className="grid gap-4">
          {visibleTypes.map((type) => {
            const typeResults = visibleResults.filter((result) => result.type === type);

            return typeResults.length ? (
              <SearchResultGroup
                hasMore={response.hasMore.includes(type)}
                key={type}
                onOpenResult={onOpenResult}
                query={response.query}
                results={typeResults}
                type={type}
              />
            ) : null;
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="grid min-h-56 place-items-center p-6 text-center">
            <div>
              <SearchX aria-hidden="true" className="mx-auto h-7 w-7 text-primary" />
              <p className="mt-3 text-sm font-semibold">No matching results</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Try a shorter keyword, another case scope, or fewer filters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {visibleHasMore && canLoadMore ? (
        <Button
          className="mx-auto"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {isLoadingMore ? "Loading more..." : "Show more results"}
        </Button>
      ) : visibleHasMore ? (
        <p className="text-center text-xs text-muted-foreground">
          Refine the search to view additional matches.
        </p>
      ) : null}
    </div>
  );
}

function ResultTab({
  active,
  count,
  hasMore,
  label,
  onClick
}: {
  active: boolean;
  count: number;
  hasMore: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground"
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] text-foreground">
        {count}
        {hasMore ? "+" : ""}
      </span>
    </button>
  );
}

function SearchResultGroup({
  hasMore,
  onOpenResult,
  query,
  results,
  type
}: {
  hasMore: boolean;
  onOpenResult: (result: GlobalSearchResult) => void;
  query: string;
  results: GlobalSearchResult[];
  type: GlobalSearchResultType;
}) {
  const config = searchTypeConfig[type];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
        <CardTitle className="flex items-center gap-2">
          <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
          {config.pluralLabel}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {results.length}
          {hasMore ? "+" : ""}
        </span>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {results.map((result) => (
          <SearchResultRow
            key={`${result.type}-${result.id}`}
            onOpen={() => onOpenResult(result)}
            query={query}
            result={result}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SearchResultRow({
  onOpen,
  query,
  result
}: {
  onOpen: () => void;
  query: string;
  result: GlobalSearchResult;
}) {
  const config = searchTypeConfig[result.type];
  const Icon = config.icon;

  return (
    <button
      className="group grid min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4"
      onClick={onOpen}
      type="button"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase text-primary">{config.label}</span>
          {result.status ? (
            <Badge variant={getSearchStatusVariant(result.status)}>
              {formatSearchStatus(result.status)}
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 block break-words text-sm font-semibold text-foreground">
          <HighlightedText query={query} text={result.title} />
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
          <HighlightedText query={query} text={result.excerpt} />
        </span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{formatSearchDate(result.date)}</span>
          {result.file ? <span>{formatSearchBytes(result.file.byteSize)}</span> : null}
          {result.caseTitle && result.type !== "CASE" ? <span>{result.caseTitle}</span> : null}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
      />
    </button>
  );
}

function HighlightedText({ query, text }: { query: string; text: string }) {
  if (!query) return text;

  const parts: Array<{ highlighted: boolean; value: string }> = [];
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({ highlighted: false, value: text.slice(cursor, matchIndex) });
    }
    parts.push({
      highlighted: true,
      value: text.slice(matchIndex, matchIndex + query.length)
    });
    cursor = matchIndex + query.length;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (!parts.length) return text;
  if (cursor < text.length) parts.push({ highlighted: false, value: text.slice(cursor) });

  return parts.map((part, index) =>
    part.highlighted ? (
      <mark className="bg-transparent text-primary" key={`${part.value}-${index}`}>
        {part.value}
      </mark>
    ) : (
      <span key={`${part.value}-${index}`}>{part.value}</span>
    )
  );
}

function getSearchStatusVariant(status: string) {
  if (/FAILED|MISSING|NEEDS|OPEN/.test(status)) return "warning" as const;
  if (/READY|PROCESSED|FOUND|COMPLETE|RESOLVED|DOWNLOADED/.test(status)) {
    return "success" as const;
  }
  return "secondary" as const;
}
