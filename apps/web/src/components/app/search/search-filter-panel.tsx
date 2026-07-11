"use client";

import { useState } from "react";
import { Archive, ArrowLeft, CalendarDays, Filter, RotateCcw } from "lucide-react";
import {
  globalSearchResultTypes,
  type GlobalSearchResultType,
  type GlobalSearchStatusFilter
} from "@proofpilot/types";
import {
  createDefaultSearchFilters,
  type SearchFiltersState
} from "@/components/app/search/search-state";
import {
  searchSortOptions,
  searchStatusOptions,
  searchTypeConfig
} from "@/components/app/search/search-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

const statelessTypes = new Set<GlobalSearchResultType>(["TIMELINE", "STATEMENT"]);

interface SearchFilterPanelProps {
  cases: CaseRecord[];
  filters: SearchFiltersState;
  onApply: (filters: SearchFiltersState) => void;
  onBack: () => void;
}

export function SearchFilterPanel({ cases, filters, onApply, onBack }: SearchFilterPanelProps) {
  const [draft, setDraft] = useState<SearchFiltersState>(() => ({
    ...filters,
    types: [...filters.types]
  }));
  const [error, setError] = useState<string | null>(null);

  function toggleType(type: GlobalSearchResultType) {
    setDraft((current) => ({
      ...current,
      types: current.types.includes(type)
        ? current.types.filter((currentType) => currentType !== type)
        : [...current.types, type]
    }));
    setError(null);
  }

  function updateStatus(status: GlobalSearchStatusFilter) {
    setDraft((current) => {
      if (status === "ALL") {
        return { ...current, status };
      }

      const statefulTypes = current.types.filter((type) => !statelessTypes.has(type));
      return {
        ...current,
        status,
        types: statefulTypes.length ? statefulTypes : ["CASE"]
      };
    });
    setError(null);
  }

  function applyFilters() {
    if (!draft.types.length) {
      setError("Select at least one result type.");
      return;
    }

    if (draft.from && draft.to && draft.from > draft.to) {
      setError("Start date must be on or before the end date.");
      return;
    }

    onApply({ ...draft, types: [...draft.types] });
  }

  function resetFilters() {
    setDraft(createDefaultSearchFilters());
    setError(null);
  }

  const availableTypes = globalSearchResultTypes.filter(
    (type) => draft.status === "ALL" || !statelessTypes.has(type)
  );
  const allAvailableTypesSelected = availableTypes.every((type) => draft.types.includes(type));

  return (
    <section aria-labelledby="search-filters-heading" className="grid gap-5">
      <Button className="w-fit" onClick={onBack} type="button" variant="ghost">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to results
      </Button>

      <div>
        <p className="text-sm font-semibold text-primary">Refine workspace results</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="search-filters-heading">
          Search filters
        </h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Search scope</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Label htmlFor="search-case-scope">Case</Label>
            <Select
              className="min-h-12"
              id="search-case-scope"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  caseId: event.target.value || null
                }))
              }
              value={draft.caseId ?? ""}
            >
              <option value="">All cases</option>
              {cases.map((caseRecord) => (
                <option key={caseRecord.id} value={caseRecord.id}>
                  {caseRecord.title}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
            <CardTitle>Result types</CardTitle>
            <Button
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  types: allAvailableTypesSelected ? [] : [...availableTypes]
                }))
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              {allAvailableTypesSelected ? "Clear all" : "Select all"}
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {globalSearchResultTypes.map((type) => {
              const config = searchTypeConfig[type];
              const Icon = config.icon;
              const disabled = draft.status !== "ALL" && statelessTypes.has(type);

              return (
                <button
                  aria-pressed={draft.types.includes(type)}
                  className={cn(
                    "grid min-h-20 content-center justify-items-start gap-2 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                    draft.types.includes(type)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary/20 text-muted-foreground"
                  )}
                  disabled={disabled}
                  key={type}
                  onClick={() => toggleType(type)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{config.pluralLabel}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>State</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {searchStatusOptions.map((option) => (
              <button
                aria-pressed={draft.status === option.value}
                className={cn(
                  "grid min-h-18 content-center rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  draft.status === option.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/20 text-muted-foreground"
                )}
                key={option.value}
                onClick={() => updateStatus(option.value)}
                type="button"
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="mt-1 text-[11px] leading-4">{option.description}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="h-5 w-5 text-primary" />
              Date range
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="search-from">Start date</Label>
              <Input
                id="search-from"
                max={draft.to || undefined}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, from: event.target.value }))
                }
                type="date"
                value={draft.from}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="search-to">End date</Label>
              <Input
                id="search-to"
                min={draft.from || undefined}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, to: event.target.value }))
                }
                type="date"
                value={draft.to}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ordering</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="search-sort">Sort results</Label>
              <Select
                className="min-h-12"
                id="search-sort"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sort: event.target.value as SearchFiltersState["sort"]
                  }))
                }
                value={draft.sort}
              >
                {searchSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <label className="grid min-h-12 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-secondary/20 px-3 py-2">
              <input
                checked={draft.includeArchived}
                className="h-5 w-5 accent-primary"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    includeArchived: event.target.checked
                  }))
                }
                type="checkbox"
              />
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Archive aria-hidden="true" className="h-4 w-4 text-primary" />
                Include archived cases
              </span>
            </label>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <p
          className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={resetFilters} size="lg" type="button" variant="outline">
          <RotateCcw aria-hidden="true" className="h-5 w-5" />
          Reset filters
        </Button>
        <Button onClick={applyFilters} size="lg" type="button">
          <Filter aria-hidden="true" className="h-5 w-5" />
          Apply filters
        </Button>
      </div>
    </section>
  );
}
