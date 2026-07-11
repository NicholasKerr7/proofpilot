"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCcw, Search, X } from "lucide-react";
import type {
  CaseActivityCategory,
  CaseActivityItem,
  CaseActivityResponse
} from "@proofpilot/types";
import { ActivityRow } from "@/components/app/activity/activity-row";
import {
  activityFilters,
  groupActivityItems,
  matchesActivitySearch
} from "@/components/app/activity/activity-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

const activityPageSize = 20;

export function ActivityPanel({ selectedCase }: { selectedCase: CaseRecord }) {
  const [items, setItems] = useState<CaseActivityItem[]>([]);
  const [category, setCategory] = useState<CaseActivityCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const filteredItems = items.filter((item) => matchesActivitySearch(item, searchQuery));
  const groups = groupActivityItems(filteredItems);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialActivity() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchActivityPage(selectedCase.id, category, 0);

        if (isMounted) {
          setItems(response.items);
          setTotal(response.total);
          setHasMore(response.hasMore);
        }
      } catch (loadError) {
        if (isMounted) {
          setItems([]);
          setTotal(0);
          setHasMore(false);
          setError(
            loadError instanceof Error ? loadError.message : "Case activity could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialActivity();

    return () => {
      isMounted = false;
    };
  }, [category, refreshKey, selectedCase.id]);

  async function handleLoadMore() {
    setIsLoadingMore(true);
    setError(null);

    try {
      const response = await fetchActivityPage(selectedCase.id, category, items.length);
      setItems((currentItems) => {
        const existingIds = new Set(currentItems.map((item) => item.id));
        return [...currentItems, ...response.items.filter((item) => !existingIds.has(item.id))];
      });
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "More activity could not be loaded."
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <Card id="case-activity" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Activity log</CardTitle>
            <Badge variant="secondary">{total} events</Badge>
          </div>
          <CardDescription>Recorded changes and processing events for this case.</CardDescription>
        </div>
        <Button
          aria-label="Refresh activity"
          disabled={isLoading}
          onClick={() => setRefreshKey((currentKey) => currentKey + 1)}
          size="icon"
          title="Refresh activity"
          type="button"
          variant="outline"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="relative">
            <Label className="sr-only" htmlFor="activity-search">
              Search loaded activity
            </Label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="min-h-12 pl-10 pr-12"
              id="activity-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search activity"
              type="search"
              value={searchQuery}
            />
            {searchQuery ? (
              <Button
                aria-label="Clear activity search"
                className="absolute right-0 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
                size="icon"
                title="Clear activity search"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <div>
            <Label className="sr-only" htmlFor="activity-category">
              Filter activity category
            </Label>
            <Select
              className="min-h-12"
              id="activity-category"
              onChange={(event) => {
                setCategory(event.target.value as CaseActivityCategory);
                setSearchQuery("");
              }}
              value={category}
            >
              {activityFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error ? (
          <p
            className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div aria-busy={isLoading} aria-live="polite">
          {isLoading ? (
            <div className="grid min-h-44 place-items-center rounded-md border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
              Loading activity...
            </div>
          ) : groups.length ? (
            <div className="grid gap-5">
              {groups.map((group) => (
                <section key={group.key} aria-labelledby={`activity-date-${group.key}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <h4
                      className="text-sm font-semibold text-foreground"
                      id={`activity-date-${group.key}`}
                    >
                      {group.relativeLabel}
                    </h4>
                    <p className="text-xs text-muted-foreground">{group.dateLabel}</p>
                  </div>
                  <div className="mt-2 divide-y divide-border rounded-md border border-border bg-secondary/20">
                    {group.items.map((item) => (
                      <ActivityRow item={item} key={item.id} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid min-h-44 place-items-center rounded-md border border-dashed border-border bg-secondary/20 p-5 text-center">
              <div>
                <Activity className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-foreground">No activity found</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {searchQuery
                    ? "Try another search or clear the current query."
                    : "Recorded case events will appear here."}
                </p>
              </div>
            </div>
          )}
        </div>

        {hasMore ? (
          <Button
            className="mx-auto min-w-48"
            disabled={isLoadingMore}
            onClick={() => {
              void handleLoadMore();
            }}
            type="button"
            variant="outline"
          >
            <Activity className="h-4 w-4" aria-hidden="true" />
            {isLoadingMore ? "Loading..." : "Load more activity"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

async function fetchActivityPage(
  caseId: string,
  category: CaseActivityCategory,
  offset: number
) {
  const searchParams = new URLSearchParams({
    category,
    limit: String(activityPageSize),
    offset: String(offset)
  });

  return apiRequest<CaseActivityResponse>(`/api/cases/${caseId}/activity?${searchParams}`);
}
