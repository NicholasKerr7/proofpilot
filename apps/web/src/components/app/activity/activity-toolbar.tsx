"use client";

import { useState } from "react";
import { RefreshCcw, Search, X } from "lucide-react";
import type { CaseActivityCategory } from "@proofpilot/types";
import { activityFilters } from "@/components/app/activity/activity-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ActivityToolbarProps {
  category: CaseActivityCategory;
  isLoading: boolean;
  onCategoryChange: (category: CaseActivityCategory) => void;
  onRefresh: () => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
  total: number;
}

export function ActivityToolbar({
  category,
  isLoading,
  onCategoryChange,
  onRefresh,
  onSearchQueryChange,
  searchQuery,
  total
}: ActivityToolbarProps) {
  const [isTabletSearchOpen, setIsTabletSearchOpen] = useState(false);

  function closeTabletSearch() {
    onSearchQueryChange("");
    setIsTabletSearchOpen(false);
  }

  return (
    <CardHeader className="gap-4 border-b border-border md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6 md:py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="md:text-sm md:uppercase md:text-primary">Activity log</CardTitle>
          <Badge variant="secondary">
            {total} {total === 1 ? "event" : "events"}
          </Badge>
        </div>
        <CardDescription className="md:hidden">
          Recorded changes and processing events for this case.
        </CardDescription>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 md:flex md:items-center md:justify-end">
        <ActivitySearch
          className="col-span-2 md:hidden"
          id="activity-search-mobile"
          onSearchQueryChange={onSearchQueryChange}
          searchQuery={searchQuery}
        />

        {isTabletSearchOpen ? (
          <ActivitySearch
            autoFocus
            className="hidden w-56 md:block"
            id="activity-search-tablet"
            onClose={closeTabletSearch}
            onSearchQueryChange={onSearchQueryChange}
            searchQuery={searchQuery}
          />
        ) : (
          <Button
            aria-label="Search activity"
            className="hidden md:inline-flex"
            onClick={() => setIsTabletSearchOpen(true)}
            size="icon"
            title="Search activity"
            type="button"
            variant="outline"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <div className="min-w-0 md:w-44">
          <Label className="sr-only" htmlFor="activity-category">
            Filter activity category
          </Label>
          <Select
            className="min-h-12"
            id="activity-category"
            onChange={(event) => onCategoryChange(event.target.value as CaseActivityCategory)}
            value={category}
          >
            {activityFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </Select>
        </div>

        <Button
          aria-label="Refresh activity"
          disabled={isLoading}
          onClick={onRefresh}
          size="icon"
          title="Refresh activity"
          type="button"
          variant="outline"
        >
          <RefreshCcw
            className={cn(
              "h-4 w-4",
              isLoading ? "animate-spin motion-reduce:animate-none" : null
            )}
            aria-hidden="true"
          />
        </Button>
      </div>
    </CardHeader>
  );
}

interface ActivitySearchProps {
  autoFocus?: boolean;
  className?: string;
  id: string;
  onClose?: () => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
}

function ActivitySearch({
  autoFocus = false,
  className,
  id,
  onClose,
  onSearchQueryChange,
  searchQuery
}: ActivitySearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Label className="sr-only" htmlFor={id}>
        Search loaded activity
      </Label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        autoFocus={autoFocus}
        className="min-h-12 pl-10 pr-12"
        id={id}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder="Search activity"
        type="search"
        value={searchQuery}
      />
      {searchQuery || onClose ? (
        <Button
          aria-label={onClose ? "Close activity search" : "Clear activity search"}
          className="absolute right-0 top-1/2 -translate-y-1/2"
          onClick={onClose ?? (() => onSearchQueryChange(""))}
          size="icon"
          title={onClose ? "Close activity search" : "Clear activity search"}
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
