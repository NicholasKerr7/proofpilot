"use client";

import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Filter,
  LayoutGrid,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  type LucideIcon
} from "lucide-react";
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
const statusIcons: Record<GlobalSearchStatusFilter, LucideIcon> = {
  ALL: LayoutGrid,
  NEEDS_ATTENTION: CircleAlert,
  IN_PROGRESS: LoaderCircle,
  READY: CircleDot,
  COMPLETE: CheckCircle2
};

interface SearchFilterPanelProps {
  cases: CaseRecord[];
  compact?: boolean;
  filters: SearchFiltersState;
  onApply: (filters: SearchFiltersState, query: string) => void;
  onBack: () => void;
  query: string;
}

export function SearchFilterPanel({
  cases,
  compact = false,
  filters,
  onApply,
  onBack,
  query
}: SearchFilterPanelProps) {
  const [draft, setDraft] = useState<SearchFiltersState>(() => ({
    ...filters,
    types: [...filters.types]
  }));
  const [draftQuery, setDraftQuery] = useState(query);
  const [error, setError] = useState<string | null>(null);

  function toggleType(type: GlobalSearchResultType) {
    setDraft((current) => {
      const selectableTypes = globalSearchResultTypes.filter(
        (currentType) => current.status === "ALL" || !statelessTypes.has(currentType)
      );
      const allTypesSelected = selectableTypes.every((currentType) =>
        current.types.includes(currentType)
      );

      return {
        ...current,
        types: allTypesSelected
          ? [type]
          : current.types.includes(type)
            ? current.types.filter((currentType) => currentType !== type)
            : [...current.types, type]
      };
    });
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

    onApply({ ...draft, types: [...draft.types] }, draftQuery);
  }

  function resetFilters() {
    setDraft(createDefaultSearchFilters());
    setDraftQuery("");
    setError(null);
  }

  const availableTypes = globalSearchResultTypes.filter(
    (type) => draft.status === "ALL" || !statelessTypes.has(type)
  );
  const allAvailableTypesSelected = availableTypes.every((type) => draft.types.includes(type));

  return (
    <section
      aria-labelledby="search-filters-heading"
      className={cn(
        "grid gap-4",
        compact ? "gap-3" : "md:flex md:min-h-[calc(100dvh-15rem)] md:flex-col md:gap-3"
      )}
    >
      <div className="proof-page-header flex items-start gap-2 md:items-center">
        {!compact ? (
          <Button
            aria-label="Back to results"
            className="-ml-2 shrink-0"
            onClick={onBack}
            size="icon"
            title="Back to results"
            type="button"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Button>
        ) : null}
        <div className="min-w-0">
          {compact ? (
            <h2 className="text-base font-semibold" id="search-filters-heading">
              Filters
            </h2>
          ) : (
            <h1 className="text-2xl font-semibold sm:text-3xl" id="search-filters-heading">
              <span className="md:hidden">Filters</span>
              <span className="hidden md:inline">Search filters</span>
            </h1>
          )}
          {!compact ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Refine your search to quickly find what you need.
            </p>
          ) : null}
        </div>
      </div>

      <div className={cn("grid gap-4", compact ? "gap-3" : "md:grid-cols-2 md:gap-3")}>
        <Card
          className={cn(
            compact ? null : "md:col-span-2 md:grid md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:items-center"
          )}
        >
          <CardHeader className="p-4 pb-2 md:p-4 md:pr-3">
            <CardTitle className="flex items-center gap-2 md:text-sm md:uppercase md:text-primary">
              <BriefcaseBusiness aria-hidden="true" className="h-5 w-5 text-primary" />
              Search scope
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 md:p-4 md:pl-0">
            <Label className="sr-only" htmlFor="search-case-scope">
              Case scope
            </Label>
            <Select
              className="min-h-11"
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

        <Card
          className={cn(
            compact
              ? "hidden"
              : "md:col-span-2 md:grid md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:items-center"
          )}
        >
          <CardHeader className="p-4 pb-2 md:p-4 md:pr-3">
            <CardTitle className="flex items-center gap-2 md:text-sm md:uppercase md:text-primary">
              <Search aria-hidden="true" className="h-5 w-5 text-primary" />
              Filter by keyword
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-4 md:pl-0">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Filter by keyword"
                className="min-h-11 pl-10 pr-10"
                inputMode="search"
                maxLength={160}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Search cases, evidence, timelines, and more"
                role="searchbox"
                type="text"
                value={draftQuery}
              />
              {draftQuery ? (
                <button
                  aria-label="Clear keyword"
                  className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setDraftQuery("")}
                  type="button"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className={compact ? undefined : "md:col-span-2"}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 md:text-sm md:uppercase md:text-primary">
              <LayoutGrid aria-hidden="true" className="h-5 w-5 text-primary" />
              Result types
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "grid grid-cols-2 gap-2 p-4 pt-0",
              compact ? null : "sm:grid-cols-4"
            )}
          >
            <FilterChoice
              icon={LayoutGrid}
              label="All types"
              onClick={() => {
                setDraft((current) => ({ ...current, types: [...availableTypes] }));
                setError(null);
              }}
              pressed={allAvailableTypesSelected}
            />
            {globalSearchResultTypes.map((type) => {
              const config = searchTypeConfig[type];
              const disabled = draft.status !== "ALL" && statelessTypes.has(type);

              return (
                <FilterChoice
                  disabled={disabled}
                  icon={config.icon}
                  key={type}
                  label={config.pluralLabel}
                  onClick={() => toggleType(type)}
                  pressed={!allAvailableTypesSelected && draft.types.includes(type)}
                />
              );
            })}
          </CardContent>
        </Card>

        <Card className={compact ? undefined : "md:col-span-2"}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 md:text-sm md:uppercase md:text-primary">
              <ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "grid grid-cols-2 gap-2 p-4 pt-0",
              compact ? null : "md:grid-cols-5"
            )}
          >
            {searchStatusOptions.map((option) => (
              <FilterChoice
                description={option.description}
                icon={statusIcons[option.value]}
                key={option.value}
                label={option.label}
                onClick={() => updateStatus(option.value)}
                pressed={draft.status === option.value}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 md:text-sm md:uppercase md:text-primary">
              <CalendarDays aria-hidden="true" className="h-5 w-5 text-primary" />
              Date range
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0 min-[360px]:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="search-from">Start date</Label>
              <Input
                className="min-w-0"
                id="search-from"
                max={draft.to || undefined}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, from: event.target.value }))
                }
                type="date"
                value={draft.from}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="search-to">End date</Label>
              <Input
                className="min-w-0"
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
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 md:text-sm md:uppercase md:text-primary">
              <ArrowUpDown aria-hidden="true" className="h-5 w-5 text-primary" />
              Sort by
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0">
            <Label className="sr-only" htmlFor="search-sort">
              Sort results
            </Label>
            <Select
              className="min-h-11"
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
            <label className="grid min-h-11 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-secondary/20 px-3 py-2">
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

      <div
        className={cn(
          "grid gap-2",
          compact ? null : "sm:grid-cols-2 md:mt-auto md:gap-3"
        )}
      >
        <Button
          className="order-2 border-transparent text-primary sm:order-1 sm:border-border sm:text-foreground"
          onClick={resetFilters}
          size="lg"
          type="button"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" className="h-5 w-5" />
          Reset filters
        </Button>
        <Button className="order-1 sm:order-2" onClick={applyFilters} size="lg" type="button">
          <Filter aria-hidden="true" className="h-5 w-5" />
          Apply filters
        </Button>
      </div>
    </section>
  );
}

interface FilterChoiceProps {
  description?: string;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  pressed: boolean;
}

function FilterChoice({
  description,
  disabled = false,
  icon: Icon,
  label,
  onClick,
  pressed
}: FilterChoiceProps) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "flex min-h-12 min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
        pressed
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-secondary/20 text-muted-foreground"
      )}
      disabled={disabled}
      onClick={onClick}
      title={description}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 text-sm font-medium leading-5">{label}</span>
    </button>
  );
}
