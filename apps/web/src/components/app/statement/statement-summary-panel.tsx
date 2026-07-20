"use client";

import { FileStack, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GeneratedCaseSummary } from "@/lib/client/types";

interface StatementSummaryPanelProps {
  disabled: boolean;
  historyCount: number;
  isGenerating: boolean;
  onGenerate: () => void;
  summary: GeneratedCaseSummary | null;
}

export function StatementSummaryPanel({
  disabled,
  historyCount,
  isGenerating,
  onGenerate,
  summary
}: StatementSummaryPanelProps) {
  return (
    <section aria-labelledby="case-summary-title" className="rounded-md border border-border bg-secondary/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4
            id="case-summary-title"
            className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"
          >
            <FileStack className="h-4 w-4" aria-hidden="true" />
            Case summary
          </h4>
          {summary ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {formatDateTime(summary.updatedAt)}
            </p>
          ) : null}
        </div>
        {historyCount ? <Badge variant="secondary">{historyCount} saved</Badge> : null}
      </div>

      <p className="mt-3 text-sm leading-6 text-foreground">
        {summary?.content ?? "No generated summary has been saved for this case."}
      </p>

      <Button
        type="button"
        className="mt-4 w-full"
        variant="outline"
        disabled={disabled}
        onClick={onGenerate}
      >
        {summary ? (
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        )}
        {isGenerating ? "Generating..." : summary ? "Refresh summary" : "Generate summary"}
      </Button>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
