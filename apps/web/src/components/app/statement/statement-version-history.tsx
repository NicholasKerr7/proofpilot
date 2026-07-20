"use client";

import { CheckCircle2, FileClock, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CaseStatementVersion } from "@/lib/client/types";

interface StatementVersionHistoryProps {
  disabled: boolean;
  onRestore: (versionId: string) => void;
  restoringVersionId: string | null;
  versions: CaseStatementVersion[];
}

export function StatementVersionHistory({
  disabled,
  onRestore,
  restoringVersionId,
  versions
}: StatementVersionHistoryProps) {
  if (!versions.length) {
    return null;
  }

  return (
    <section aria-labelledby="statement-version-history-title" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4
          id="statement-version-history-title"
          className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"
        >
          <FileClock className="h-4 w-4" aria-hidden="true" />
          Version history
        </h4>
        <span className="text-xs text-muted-foreground">{versions.length} available</span>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {versions.map((version, index) => {
          const isCurrent = index === 0;
          const isRestoring = restoringVersionId === version.id;

          return (
            <div
              key={version.id}
              className="grid min-w-0 gap-3 bg-secondary/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">Version {version.version}</span>
                  {isCurrent ? (
                    <Badge variant="secondary">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Current
                    </Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(version.createdAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {version.content}
                </p>
              </div>
              {!isCurrent ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  aria-label={`Restore version ${version.version}`}
                  onClick={() => onRestore(version.id)}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {isRestoring ? "Restoring..." : "Restore"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
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
