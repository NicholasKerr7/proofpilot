"use client";

import { useState } from "react";
import type { ItemsPerPage } from "@proofpilot/types";
import {
  Archive,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  FolderOpen,
  Plus,
  Search,
  X
} from "lucide-react";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseCompletenessScore,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface CaseDashboardProps {
  cases: CaseRecord[];
  confirmBeforeDelete: boolean;
  isLoading: boolean;
  itemsPerPage: ItemsPerPage;
  onArchiveCase: (caseId: string) => Promise<boolean>;
  onCreateCase: () => void;
  onSelectCase: (caseId: string) => Promise<void>;
  selectedCaseId: string | null;
}

const statusFilters = [
  { label: "All cases", value: "all" },
  { label: "Needs action", value: "needs_action" },
  { label: "Active", value: "active" },
  { label: "Review", value: "review" },
  { label: "Complete", value: "complete" }
] as const;

type StatusFilter = (typeof statusFilters)[number]["value"];
type SortOrder = "newest" | "deadline" | "progress";

export function CaseDashboard({
  cases,
  confirmBeforeDelete,
  isLoading,
  itemsPerPage,
  onArchiveCase,
  onCreateCase,
  onSelectCase,
  selectedCaseId
}: CaseDashboardProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);
  const [caseToArchiveId, setCaseToArchiveId] = useState<string | null>(null);
  const [archivingCaseId, setArchivingCaseId] = useState<string | null>(null);
  const filteredCases = sortCases(filterCases(cases, query, statusFilter), sortOrder);
  const pageCount = Math.max(1, Math.ceil(filteredCases.length / itemsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * itemsPerPage;
  const visibleCases = filteredCases.slice(pageStart, pageStart + itemsPerPage);

  async function handleArchiveCase(caseId: string) {
    setArchivingCaseId(caseId);
    const wasArchived = await onArchiveCase(caseId);
    setArchivingCaseId(null);

    if (wasArchived) {
      setCaseToArchiveId(null);
    }
  }

  return (
    <section id="case-dashboard" aria-labelledby="cases-heading" className="grid scroll-mt-28 gap-5 lg:scroll-mt-24">
      <div className="proof-page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Case management</p>
          <h1 id="cases-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
            Cases
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage and track your private case workspaces.</p>
        </div>
        <Button onClick={onCreateCase} type="button">
          <Plus className="h-4 w-4" aria-hidden="true" />
          New case
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search cases"
            className="pl-9"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search cases"
            type="search"
            value={query}
          />
        </div>
        <label className="grid grid-cols-[auto_minmax(9rem,1fr)] items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
          <Select
            aria-label="Sort cases"
            onChange={(event) => {
              setSortOrder(event.target.value as SortOrder);
              setPage(1);
            }}
            value={sortOrder}
          >
            <option value="newest">Recently updated</option>
            <option value="deadline">Nearest deadline</option>
            <option value="progress">Highest progress</option>
          </Select>
        </label>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1 scroll-container"
        role="group"
        aria-label="Filter cases by status"
      >
        {statusFilters.map((filter) => (
          <Button
            key={filter.value}
            aria-pressed={statusFilter === filter.value}
            className="shrink-0"
            onClick={() => {
              setStatusFilter(filter.value);
              setPage(1);
            }}
            size="sm"
            type="button"
            variant={statusFilter === filter.value ? "default" : "outline"}
          >
            {filter.label}
            <span className="rounded-md border border-current/20 px-1.5 py-0.5 text-[10px]">
              {cases.filter((caseRecord) => matchesStatusFilter(caseRecord.status, filter.value)).length}
            </span>
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {filteredCases.length
            ? `${pageStart + 1}-${Math.min(pageStart + itemsPerPage, filteredCases.length)} of ${filteredCases.length}`
            : "0"}{" "}
          {filteredCases.length === 1 ? "case" : "cases"}
        </span>
        {query || statusFilter !== "all" ? <span>Filtered from {cases.length}</span> : null}
      </div>

      {visibleCases.length ? (
        <div className="hidden grid-cols-[3.25rem_minmax(15rem,1.4fr)_minmax(9rem,0.65fr)_minmax(9rem,0.65fr)_minmax(8rem,0.55fr)_5.5rem_2.75rem] items-center gap-4 border-y border-border px-5 py-3 text-xs font-medium text-muted-foreground xl:grid">
          <span aria-hidden="true" />
          <span>Case</span>
          <span>Type</span>
          <span>Status</span>
          <span>Deadline</span>
          <span>Progress</span>
          <span className="sr-only">Actions</span>
        </div>
      ) : null}

      <div className="grid gap-3">
        {isLoading ? (
          <Card>
            <CardContent className="flex min-h-32 items-center gap-3 p-4 text-sm text-muted-foreground">
              <FolderOpen className="h-5 w-5 text-primary" aria-hidden="true" />
              Loading cases...
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && cases.length === 0 ? (
          <Card>
            <CardContent className="grid min-h-56 place-items-center p-6 text-center">
              <div className="max-w-sm">
                <FolderOpen className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold">No cases yet</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Create the first appeal case to start collecting evidence.
                </p>
                <Button className="mt-5" onClick={onCreateCase} type="button">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create case
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && cases.length > 0 && filteredCases.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-secondary/25 px-4 py-6 text-center text-sm text-muted-foreground">
            No cases match the current search and filter.
          </p>
        ) : null}

        {visibleCases.map((caseRecord) => (
          <CaseListItem
            key={caseRecord.id}
            caseRecord={caseRecord}
            isArchiving={archivingCaseId === caseRecord.id}
            isPendingArchive={caseToArchiveId === caseRecord.id}
            isSelected={selectedCaseId === caseRecord.id}
            onCancelArchive={() => setCaseToArchiveId(null)}
            onConfirmArchive={handleArchiveCase}
            onOpen={onSelectCase}
            onRequestArchive={() => {
              if (confirmBeforeDelete) {
                setCaseToArchiveId(caseRecord.id);
              } else {
                void handleArchiveCase(caseRecord.id);
              }
            }}
          />
        ))}
      </div>

      {pageCount > 1 ? (
        <nav
          aria-label="Case list pages"
          className="flex items-center justify-between gap-3 border-t border-border pt-3"
        >
          <Button
            aria-label="Previous case page"
            disabled={currentPage === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            size="icon"
            title="Previous case page"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {pageCount}
          </span>
          <Button
            aria-label="Next case page"
            disabled={currentPage === pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            size="icon"
            title="Next case page"
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </nav>
      ) : null}
    </section>
  );
}

interface CaseListItemProps {
  caseRecord: CaseRecord;
  isArchiving: boolean;
  isPendingArchive: boolean;
  isSelected: boolean;
  onCancelArchive: () => void;
  onConfirmArchive: (caseId: string) => Promise<void>;
  onOpen: (caseId: string) => Promise<void>;
  onRequestArchive: () => void;
}

function CaseListItem({
  caseRecord,
  isArchiving,
  isPendingArchive,
  isSelected,
  onCancelArchive,
  onConfirmArchive,
  onOpen,
  onRequestArchive
}: CaseListItemProps) {
  const completeness = getCaseCompletenessScore(caseRecord);

  return (
    <article
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "proof-interactive-surface rounded-md border border-border bg-card",
        isSelected ? "border-primary/55" : null
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 p-2 md:gap-2 md:p-3">
        <button
          className="group grid min-h-32 min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 rounded-md p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[4.5rem_minmax(0,1fr)_auto_auto] md:items-center md:gap-5 xl:min-h-20 xl:grid-cols-[3.25rem_minmax(15rem,1.4fr)_minmax(9rem,0.65fr)_minmax(9rem,0.65fr)_minmax(8rem,0.55fr)_5.5rem_auto] xl:gap-4 xl:p-2"
          onClick={() => {
            void onOpen(caseRecord.id);
          }}
          type="button"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-xl font-semibold text-primary md:h-16 md:w-16 md:text-2xl xl:h-12 xl:w-12 xl:text-lg">
            {getPlatformInitial(caseRecord.platform)}
          </span>

          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              {isSelected ? <Badge>Primary case</Badge> : null}
              {caseRecord.access?.role && caseRecord.access.role !== "OWNER" ? (
                <Badge variant="secondary">
                  Shared {caseRecord.access.role === "EDITOR" ? "editor" : "viewer"}
                </Badge>
              ) : null}
              <Badge className="xl:hidden" variant={getCaseStatusVariant(caseRecord.status)}>
                {formatCaseStatus(caseRecord.status)}
              </Badge>
            </span>
            <span className="mt-2 block break-words text-base font-semibold leading-6 text-foreground md:text-lg">
              {caseRecord.title}
            </span>
            <span className="mt-1 block font-mono text-xs text-muted-foreground">
              {formatCaseReference(caseRecord)}
            </span>
            <span className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:hidden">
              <span>
                <span className="block">Deadline</span>
                <span className="mt-1 block font-medium text-foreground">
                  {caseRecord.deadline ? formatCaseDate(caseRecord.deadline) : "Not set"}
                </span>
              </span>
              <span>
                <span className="block">Evidence</span>
                <span className="mt-1 block font-medium text-foreground">
                  {caseRecord._count?.documents ?? 0} files
                </span>
              </span>
            </span>
          </span>

          <span className="hidden min-w-0 xl:block">
            <span className="block break-words text-sm font-medium text-foreground">
              {caseRecord.caseType.name}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{caseRecord.platform}</span>
          </span>

          <span className="hidden xl:block">
            <Badge variant={getCaseStatusVariant(caseRecord.status)}>
              {formatCaseStatus(caseRecord.status)}
            </Badge>
          </span>

          <span className="hidden text-sm font-medium text-foreground xl:block">
            {caseRecord.deadline ? formatCaseDate(caseRecord.deadline) : "Not set"}
          </span>

          <CaseProgressRing
            className="hidden sm:grid"
            label="Completeness"
            size="compact"
            value={completeness}
          />
          <ArrowRight
            className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground"
            aria-hidden="true"
          />
        </button>

        {caseRecord.access?.canManage !== false ? (
          <Button
            aria-label={`Archive ${caseRecord.title}`}
            disabled={isArchiving}
            onClick={onRequestArchive}
            size="icon"
            title={`Archive ${caseRecord.title}`}
            type="button"
            variant="ghost"
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {isPendingArchive ? (
        <div className="grid gap-3 border-t border-amber-300/25 bg-amber-300/10 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold text-amber-100">Archive this case?</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              It will leave the active cases list but its stored records remain intact.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isArchiving} onClick={onCancelArchive} size="sm" type="button" variant="ghost">
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
            <Button
              disabled={isArchiving}
              onClick={() => {
                void onConfirmArchive(caseRecord.id);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              {isArchiving ? "Archiving..." : "Archive"}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function filterCases(cases: CaseRecord[], query: string, statusFilter: StatusFilter) {
  const normalizedQuery = query.trim().toLowerCase();

  return cases.filter((caseRecord) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        caseRecord.title,
        caseRecord.platform,
        caseRecord.status,
        caseRecord.summary,
        caseRecord.caseType.name,
        formatCaseReference(caseRecord)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesQuery && matchesStatusFilter(caseRecord.status, statusFilter);
  });
}

function matchesStatusFilter(status: string, statusFilter: StatusFilter) {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "needs_action") {
    return status === "NEEDS_MORE_EVIDENCE";
  }

  if (statusFilter === "active") {
    return status === "DRAFT" || status === "COLLECTING_EVIDENCE" || status === "PROCESSING";
  }

  if (statusFilter === "review") {
    return status === "READY_FOR_REVIEW";
  }

  return status === "PACKET_GENERATED" || status === "SUBMITTED" || status === "RESOLVED";
}

function sortCases(cases: CaseRecord[], sortOrder: SortOrder) {
  return [...cases].sort((first, second) => {
    if (sortOrder === "deadline") {
      const firstDeadline = first.deadline ? new Date(first.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const secondDeadline = second.deadline ? new Date(second.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return firstDeadline - secondDeadline;
    }

    if (sortOrder === "progress") {
      return getCaseCompletenessScore(second) - getCaseCompletenessScore(first);
    }

    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
  });
}

function getPlatformInitial(platform: string) {
  return platform.trim().charAt(0).toUpperCase() || "P";
}
