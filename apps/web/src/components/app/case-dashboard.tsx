"use client";

import { useState } from "react";
import { Archive, ArrowUpRight, FileText, FolderOpen, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { CaseRecord } from "@/lib/client/types";

interface CaseDashboardProps {
  cases: CaseRecord[];
  isLoading: boolean;
  onArchiveCase: (caseId: string) => Promise<void>;
  onSelectCase: (caseId: string) => void;
  selectedCaseId: string | null;
}

export function CaseDashboard({
  cases,
  isLoading,
  onArchiveCase,
  onSelectCase,
  selectedCaseId
}: CaseDashboardProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const metrics = getMetrics(cases);
  const filteredCases = filterCases(cases, query, statusFilter);

  return (
    <div id="case-dashboard" className="grid scroll-mt-28 grid-cols-1 gap-5 lg:scroll-mt-8">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                <metric.icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Case command center</CardTitle>
            <CardDescription>Private cases owned by your account.</CardDescription>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search cases"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cases"
                value={query}
              />
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="group"
              aria-label="Filter cases by status"
            >
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                  className="shrink-0"
                  aria-pressed={statusFilter === filter.value}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading cases...</p> : null}
          {!isLoading && cases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/35 p-5 text-sm text-muted-foreground">
              No cases yet. Create the first appeal case to start collecting evidence.
            </div>
          ) : null}
          {!isLoading && cases.length > 0 && filteredCases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/35 p-5 text-sm text-muted-foreground">
              No cases match the current search and filter.
            </div>
          ) : null}
          {!isLoading && filteredCases.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing {filteredCases.length} of {cases.length} cases
            </p>
          ) : null}
          {filteredCases.map((caseRecord) => {
            const readiness = getReadiness(caseRecord);
            const isSelected = selectedCaseId === caseRecord.id;

            return (
              <article
                key={caseRecord.id}
                className="grid gap-4 rounded-lg border border-border bg-secondary/45 p-4 md:grid-cols-[1fr_190px] md:items-center"
                aria-current={isSelected ? "true" : undefined}
              >
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{caseRecord.platform}</Badge>
                    <Badge>{formatStatus(caseRecord.status)}</Badge>
                    {isSelected ? <Badge variant="success">Open</Badge> : null}
                  </div>
                  <h2 className="text-base font-semibold">{caseRecord.title}</h2>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>{caseRecord._count?.documents ?? 0} evidence files</span>
                    <span>{caseRecord._count?.checklist ?? 0} checklist items</span>
                    <span>{caseRecord.deadline ? formatDate(caseRecord.deadline) : "No deadline"}</span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Progress value={readiness} label="Packet readiness" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectCase(caseRecord.id)}
                      aria-label={`Open ${caseRecord.title}`}
                    >
                      Open
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onArchiveCase(caseRecord.id)}
                      aria-label={`Archive ${caseRecord.title}`}
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      Archive
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Collecting", value: "collecting" },
  { label: "Needs evidence", value: "needs_evidence" },
  { label: "Ready", value: "ready" },
  { label: "Packet", value: "packet" }
] as const;

type StatusFilter = (typeof statusFilters)[number]["value"];

function filterCases(cases: CaseRecord[], query: string, statusFilter: StatusFilter) {
  const normalizedQuery = normalizeSearch(query);

  return cases.filter((caseRecord) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      normalizeSearch(
        [
          caseRecord.title,
          caseRecord.platform,
          caseRecord.status,
          caseRecord.summary,
          caseRecord.caseType.name,
          caseRecord.deadline
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(normalizedQuery);

    return matchesQuery && matchesStatusFilter(caseRecord.status, statusFilter);
  });
}

function matchesStatusFilter(status: string, statusFilter: StatusFilter) {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "collecting") {
    return status === "COLLECTING_EVIDENCE" || status === "PROCESSING";
  }

  if (statusFilter === "needs_evidence") {
    return status === "NEEDS_MORE_EVIDENCE";
  }

  if (statusFilter === "ready") {
    return status === "READY_FOR_REVIEW";
  }

  return status === "PACKET_GENERATED" || status === "SUBMITTED" || status === "RESOLVED";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function getMetrics(cases: CaseRecord[]) {
  const evidenceCount = cases.reduce((total, item) => total + (item._count?.documents ?? 0), 0);
  const checklistCount = cases.reduce((total, item) => total + (item._count?.checklist ?? 0), 0);
  const averageReadiness =
    cases.length > 0
      ? Math.round(cases.reduce((total, item) => total + getReadiness(item), 0) / cases.length)
      : 0;

  return [
    { label: "Open cases", value: String(cases.length), detail: "Active appeal workspaces", icon: FolderOpen },
    { label: "Evidence files", value: String(evidenceCount), detail: "Uploaded documents", icon: FileText },
    { label: "Checklist items", value: String(checklistCount), detail: "Evidence requirements", icon: TriangleAlert },
    { label: "Packet status", value: `${averageReadiness}%`, detail: "Average readiness", icon: ShieldCheck }
  ];
}

function getReadiness(caseRecord: CaseRecord) {
  const documentScore = Math.min(40, (caseRecord._count?.documents ?? 0) * 10);
  const eventScore = Math.min(25, (caseRecord._count?.events ?? 0) * 8);
  const checklistScore = Math.min(25, (caseRecord._count?.checklist ?? 0) * 5);
  const statementScore = caseRecord.summary || caseRecord._count?.statements ? 10 : 0;

  return documentScore + eventScore + checklistScore + statementScore;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}
