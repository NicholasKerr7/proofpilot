"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Filter, RefreshCcw, Search, X } from "lucide-react";
import type { GlobalSearchResponse, GlobalSearchResult } from "@proofpilot/types";
import { SearchFilterPanel } from "@/components/app/search/search-filter-panel";
import {
  buildSearchParams,
  countActiveSearchFilters,
  createDefaultSearchFilters,
  type SearchFiltersState
} from "@/components/app/search/search-state";
import {
  SearchResultsView,
  type SearchResultTab
} from "@/components/app/search/search-results-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

const initialResultLimit = 8;
const maximumResultLimit = 50;

interface SearchPanelProps {
  cases: CaseRecord[];
  onOpenResult: (result: GlobalSearchResult) => void;
}

export function SearchPanel({ cases, onOpenResult }: SearchPanelProps) {
  const [view, setView] = useState<"results" | "filters">("results");
  const [draftQuery, setDraftQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [filters, setFilters] = useState<SearchFiltersState>(createDefaultSearchFilters);
  const [response, setResponse] = useState<GlobalSearchResponse | null>(null);
  const [activeTab, setActiveTab] = useState<SearchResultTab>("ALL");
  const [resultLimit, setResultLimit] = useState(initialResultLimit);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeFilterCount = countActiveSearchFilters(filters);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadResults() {
      setIsLoading(true);
      setError(null);

      try {
        const searchParams = buildSearchParams(submittedQuery, filters, resultLimit);
        const result = await apiRequest<GlobalSearchResponse>(`/api/search?${searchParams}`, {
          signal: controller.signal
        });

        if (isMounted) {
          setResponse(result);
        }
      } catch (loadError) {
        if (isMounted && !(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "Search results could not be loaded.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [filters, refreshKey, resultLimit, submittedQuery]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    setSubmittedQuery(nextQuery);
    setResultLimit(initialResultLimit);
    setActiveTab("ALL");
    setResponse(null);
    setRefreshKey((current) => current + 1);
  }

  function clearSearch() {
    setDraftQuery("");
    setSubmittedQuery("");
    setResultLimit(initialResultLimit);
    setActiveTab("ALL");
    setResponse(null);
    setRefreshKey((current) => current + 1);
  }

  function applyFilters(nextFilters: SearchFiltersState, nextQuery: string) {
    const normalizedQuery = nextQuery.trim();
    setDraftQuery(normalizedQuery);
    setSubmittedQuery(normalizedQuery);
    setFilters(nextFilters);
    setResultLimit(initialResultLimit);
    setActiveTab("ALL");
    setResponse(null);
    setView("results");
    scrollToTop();
  }

  if (view === "filters") {
    return (
      <SearchFilterPanel
        cases={cases}
        filters={filters}
        onApply={applyFilters}
        onBack={() => {
          setView("results");
          scrollToTop();
        }}
        query={draftQuery}
      />
    );
  }

  return (
    <section aria-labelledby="global-search-heading" className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-primary">Across your private workspace</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="global-search-heading">
          Search
        </h1>
      </div>

      <form
        className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2"
        onSubmit={handleSearch}
      >
        <div className="relative min-w-0">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search workspace"
            className="min-h-12 border-primary/40 pl-12 pr-11"
            maxLength={160}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Search cases, evidence, timelines, and more"
            inputMode="search"
            role="searchbox"
            type="text"
            value={draftQuery}
          />
          {draftQuery ? (
            <button
              aria-label="Clear search"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={clearSearch}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Button aria-label="Run search" size="icon" title="Run search" type="submit">
          <Search aria-hidden="true" className="h-5 w-5" />
        </Button>
        <Button
          aria-label="Open search filters"
          className="relative"
          onClick={() => {
            setView("filters");
            scrollToTop();
          }}
          size="icon"
          title="Search filters"
          type="button"
          variant="outline"
        >
          <Filter aria-hidden="true" className="h-5 w-5" />
          {activeFilterCount ? (
            <Badge className="absolute -right-2 -top-2 min-w-5 justify-center px-1 text-[10px]">
              {activeFilterCount}
            </Badge>
          ) : null}
        </Button>
      </form>

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-3 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>{error}</span>
          <Button
            onClick={() => setRefreshKey((current) => current + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCcw aria-hidden="true" className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : null}

      {isLoading && !response ? (
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-6 text-sm text-muted-foreground">
            Searching your workspace...
          </CardContent>
        </Card>
      ) : response ? (
        <SearchResultsView
          activeTab={activeTab}
          canLoadMore={resultLimit < maximumResultLimit}
          isLoadingMore={isLoading}
          onLoadMore={() =>
            setResultLimit((current) => Math.min(maximumResultLimit, current + initialResultLimit))
          }
          onOpenResult={onOpenResult}
          onTabChange={setActiveTab}
          response={response}
        />
      ) : null}
    </section>
  );
}

function scrollToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      top: 0
    });
  });
}
