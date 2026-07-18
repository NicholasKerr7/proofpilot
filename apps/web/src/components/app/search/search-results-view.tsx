import { Search, SearchX, type LucideIcon } from "lucide-react";
import {
  globalSearchResultTypes,
  type GlobalSearchResponse,
  type GlobalSearchResult,
  type GlobalSearchResultType
} from "@proofpilot/types";
import {
  searchTypeConfig
} from "@/components/app/search/search-utils";
import { SearchResultGroup } from "@/components/app/search/search-result-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    activeTab === "ALL"
      ? globalSearchResultTypes.filter((type) => response.counts[type] > 0)
      : ([activeTab] as GlobalSearchResultType[]);
  const visibleHasMore =
    activeTab === "ALL" ? response.hasMore.length > 0 : response.hasMore.includes(activeTab);
  const visibleTotal = activeTab === "ALL" ? response.total : response.counts[activeTab];
  const availableTypes = globalSearchResultTypes.filter((type) => response.counts[type] > 0);

  return (
    <div className="grid gap-5">
      <div
        aria-label="Search result types"
        className="order-1 flex gap-2 overflow-x-auto pb-1 [overscroll-behavior-x:contain] [-webkit-overflow-scrolling:touch] md:order-2"
        role="tablist"
      >
        <ResultTab
          active={activeTab === "ALL"}
          count={response.total}
          icon={Search}
          label="All results"
          onClick={() => onTabChange("ALL")}
          tab="ALL"
        />
        {availableTypes.map((type) => (
          <ResultTab
            active={activeTab === type}
            count={response.counts[type]}
            icon={searchTypeConfig[type].icon}
            key={type}
            label={searchTypeConfig[type].pluralLabel}
            onClick={() => onTabChange(type)}
            tab={type}
          />
        ))}
      </div>

      <div className="order-2 flex flex-wrap items-end justify-between gap-3 md:order-1">
        <div>
          <h2 className="text-sm font-semibold uppercase text-muted-foreground md:text-2xl md:normal-case md:text-foreground">
            Search results
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {response.query ? `Results for "${response.query}"` : "Recent workspace activity"}
            {` in ${response.scope.label}`}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {visibleTotal} {visibleTotal === 1 ? "result" : "results"}
        </p>
      </div>

      <div
        aria-labelledby={getSearchResultTabId(activeTab)}
        className="order-3"
        id="search-result-groups"
        role="tabpanel"
      >
        {visibleResults.length ? (
          <div className="grid gap-4">
            {visibleTypes.map((type) => {
              const typeResults = visibleResults.filter((result) => result.type === type);

              return typeResults.length ? (
                <SearchResultGroup
                  key={type}
                  onOpenResult={onOpenResult}
                  query={response.query}
                  results={typeResults}
                  total={response.counts[type]}
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
      </div>

      {visibleHasMore && canLoadMore ? (
        <Button
          className="order-4 mx-auto"
          disabled={isLoadingMore}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {isLoadingMore ? "Loading more..." : "Show more results"}
        </Button>
      ) : visibleHasMore ? (
        <p className="order-4 text-center text-xs text-muted-foreground">
          Refine the search to view additional matches.
        </p>
      ) : null}
    </div>
  );
}

function ResultTab({
  active,
  count,
  icon: Icon,
  label,
  onClick,
  tab
}: {
  active: boolean;
  count: number;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tab: SearchResultTab;
}) {
  return (
    <button
      aria-controls="search-result-groups"
      aria-selected={active}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground"
      )}
      id={getSearchResultTabId(tab)}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] text-foreground">
        {count}
      </span>
    </button>
  );
}

function getSearchResultTabId(tab: SearchResultTab) {
  return `search-result-tab-${tab.toLowerCase()}`;
}
