"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BarChart3, Download, RefreshCcw } from "lucide-react";
import type { ReportSummary } from "@proofpilot/types";
import { ReportAnalytics } from "@/components/app/reports/report-analytics";
import { ReportExportForm } from "@/components/app/reports/report-export-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

type ReportsMode = "analytics" | "export";

interface ReportsPanelProps {
  cases: CaseRecord[];
  onOpenCase: (caseId: string) => void;
}

export function ReportsPanel({ cases, onOpenCase }: ReportsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<ReportsMode>("analytics");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const selectedCase = selectedCaseId
    ? cases.find((caseRecord) => caseRecord.id === selectedCaseId) ?? null
    : null;
  const scopeLabel = selectedCaseId
    ? selectedCase?.title ?? "Selected case"
    : "All cases";

  function openExport(caseId?: string) {
    if (caseId) {
      setSelectedCaseId(caseId);
    }

    changeMode("export");
  }

  function changeMode(nextMode: ReportsMode) {
    setMode(nextMode);
    window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: "start" });
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setIsLoading(true);
      setError(null);

      try {
        const searchParams = selectedCaseId
          ? `?${new URLSearchParams({ caseId: selectedCaseId })}`
          : "";
        const nextSummary = await apiRequest<ReportSummary>(
          `/api/reports/summary${searchParams}`
        );

        if (isMounted) {
          setSummary(nextSummary);
        }
      } catch (loadError) {
        if (isMounted) {
          setSummary(null);
          setError(
            loadError instanceof Error ? loadError.message : "Reports could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, selectedCaseId]);

  return (
    <section
      aria-labelledby="reports-heading"
      className="grid scroll-mt-24 gap-5"
      ref={panelRef}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {mode === "export" ? (
            <Button
              aria-label="Back to report analytics"
              className="mt-1 shrink-0"
              onClick={() => changeMode("analytics")}
              size="icon"
              title="Back to report analytics"
              type="button"
              variant="ghost"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">Workspace reporting</p>
            <h1 id="reports-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
              {mode === "export" ? "Export report" : "Reports & analytics"}
            </h1>
            {mode === "export" ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Configure and download an owner-scoped case report.
              </p>
            ) : null}
          </div>
        </div>
        {mode === "analytics" ? (
          <Button
            aria-label="Refresh reports"
            disabled={isLoading}
            onClick={() => setRefreshKey((currentKey) => currentKey + 1)}
            size="icon"
            title="Refresh reports"
            type="button"
            variant="outline"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="grid gap-2">
          <Label htmlFor="report-case-scope">Report scope</Label>
          <Select
            className="min-h-12"
            id="report-case-scope"
            onChange={(event) => {
              setSelectedCaseId(event.target.value === "all" ? null : event.target.value);
              setError(null);
            }}
            value={selectedCaseId ?? "all"}
          >
            <option value="all">All cases</option>
            {cases.map((caseRecord) => (
              <option key={caseRecord.id} value={caseRecord.id}>
                {caseRecord.title}
              </option>
            ))}
          </Select>
        </div>

        <div
          aria-label="Report views"
          className="grid grid-cols-2 rounded-md border border-border bg-card p-1 md:min-w-72"
          role="group"
        >
          <ReportModeButton
            active={mode === "analytics"}
            icon={BarChart3}
            label="Analytics"
            onClick={() => changeMode("analytics")}
          />
          <ReportModeButton
            active={mode === "export"}
            icon={Download}
            label="Export"
            onClick={() => changeMode("export")}
          />
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

      {isLoading && mode === "analytics" ? (
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-6 text-sm text-muted-foreground">
            Loading report data...
          </CardContent>
        </Card>
      ) : mode === "analytics" && summary ? (
        <ReportAnalytics
          onExport={openExport}
          onOpenCase={onOpenCase}
          summary={summary}
        />
      ) : mode === "export" ? (
        <ReportExportForm
          caseId={selectedCaseId}
          scopeLabel={scopeLabel}
          selectedCase={selectedCase}
        />
      ) : null}
    </section>
  );
}

interface ReportModeButtonProps {
  active: boolean;
  icon: typeof BarChart3;
  label: string;
  onClick: () => void;
}

function ReportModeButton({ active, icon: Icon, label, onClick }: ReportModeButtonProps) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-secondary text-primary" : null
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
