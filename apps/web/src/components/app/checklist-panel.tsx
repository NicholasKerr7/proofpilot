"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, FileCheck2, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord, ChecklistItem } from "@/lib/client/types";

interface ChecklistPanelProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  selectedCase: CaseRecord;
}

type ChecklistNotice = {
  tone: "success" | "error";
  text: string;
};

const checklistPlaceholders = [
  "Closure or restriction screenshot",
  "Support conversation",
  "Account ownership proof",
  "Transaction or activity context"
];

export function ChecklistPanel({ onCaseChanged, selectedCase }: ChecklistPanelProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(() =>
    getChecklistItems(selectedCase)
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(
    selectedCase.checklist?.[0]?.id ?? null
  );
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
  const [isAnalyzingChecklist, setIsAnalyzingChecklist] = useState(false);
  const [checklistNotice, setChecklistNotice] = useState<ChecklistNotice | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadChecklist() {
      setChecklistItems(getChecklistItems(selectedCase));
      setIsLoadingChecklist(true);
      setChecklistNotice(null);

      try {
        const nextItems = await apiRequest<ChecklistItem[]>(
          `/api/cases/${selectedCase.id}/checklist`
        );

        if (isMounted) {
          const displayItems = nextItems.length ? nextItems : getPlaceholderChecklistItems();
          setChecklistItems(displayItems);
          setExpandedItemId((currentId) =>
            displayItems.some((item) => item.id === currentId) ? currentId : displayItems[0]?.id ?? null
          );
        }
      } catch (error) {
        if (isMounted) {
          setChecklistNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Checklist could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingChecklist(false);
        }
      }
    }

    void loadChecklist();

    return () => {
      isMounted = false;
    };
  }, [selectedCase]);

  async function handleAnalyzeChecklist() {
    setIsAnalyzingChecklist(true);
    setChecklistNotice(null);

    try {
      const updatedCase = await apiRequest<CaseRecord>(
        `/api/cases/${selectedCase.id}/checklist/analyze`,
        {
          method: "POST"
        }
      );
      const nextItems = getChecklistItems(updatedCase);
      setChecklistItems(nextItems);
      setExpandedItemId((currentId) =>
        nextItems.some((item) => item.id === currentId) ? currentId : nextItems[0]?.id ?? null
      );
      await onCaseChanged(selectedCase.id);
      setChecklistNotice({
        tone: "success",
        text: "Checklist refreshed from processed evidence."
      });
    } catch (error) {
      setChecklistNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Checklist analysis failed."
      });
    } finally {
      setIsAnalyzingChecklist(false);
    }
  }

  const readyCount = checklistItems.filter((item) => isChecklistReady(item.status)).length;

  return (
    <Card id="evidence-checklist" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Evidence checklist</CardTitle>
            <CardDescription>Review missing proof and matched evidence.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleAnalyzeChecklist();
            }}
            disabled={isAnalyzingChecklist}
          >
            <RefreshCcw className="h-4 w-4" />
            {isAnalyzingChecklist ? "Analyzing..." : "Analyze evidence"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {checklistNotice ? (
          <p
            className={
              checklistNotice.tone === "success"
                ? "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100"
                : "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            }
          >
            {checklistNotice.text}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/35 px-3 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Evidence readiness
          </span>
          <Badge variant={readyCount === checklistItems.length ? "success" : "warning"}>
            {readyCount}/{checklistItems.length} ready
          </Badge>
        </div>

        {isLoadingChecklist ? (
          <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            Loading checklist details...
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-2">
          {checklistItems.map((checklistItem) => {
            const firstMatch = checklistItem.matches?.[0];
            const isExpanded = expandedItemId === checklistItem.id;
            const statusReady = isChecklistReady(checklistItem.status);

            return (
              <div
                key={checklistItem.id}
                className="rounded-md border border-border bg-secondary/45"
              >
                <div className="flex items-start justify-between gap-2 px-3 py-3">
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-start justify-between gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpandedItemId(isExpanded ? null : checklistItem.id);
                    }}
                  >
                    <span className="flex min-w-0 items-start gap-2">
                      {getChecklistIcon(checklistItem.status)}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{checklistItem.label}</span>
                        <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                          {firstMatch
                            ? `Matched ${firstMatch.document.originalName}`
                            : checklistItem.description}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={
                        isExpanded
                          ? "h-4 w-4 rotate-180 text-muted-foreground transition-transform"
                          : "h-4 w-4 text-muted-foreground transition-transform"
                      }
                    />
                  </button>
                  <Badge variant={getChecklistStatusVariant(checklistItem.status)}>
                    {formatChecklistStatus(checklistItem.status)}
                  </Badge>
                </div>

                {isExpanded ? (
                  <div className="grid grid-cols-1 gap-3 px-3 pb-3">
                    <Separator />
                    <div className="grid grid-cols-1 gap-1.5">
                      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                        Requirement
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {checklistItem.description}
                      </p>
                    </div>

                    {checklistItem.matches?.length ? (
                      <div className="grid grid-cols-1 gap-2">
                        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                          Matched evidence
                        </p>
                        {checklistItem.matches.map((match) => (
                          <div
                            key={match.id}
                            className="rounded-md border border-border bg-background/35 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="min-w-0 truncate font-medium text-foreground">
                                {match.document.originalName}
                              </span>
                              <Badge variant="secondary">
                                {Math.round(match.confidence * 100)}%
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {match.rationale ?? "Matched by checklist analysis."}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-border bg-background/30 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                          Next action
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Upload evidence that satisfies this requirement, then run Analyze evidence.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{statusReady ? "Ready for packet review" : "Needs more support"}</span>
                      <span>Updated {formatDateTime(checklistItem.updatedAt)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function getChecklistItems(caseRecord: CaseRecord) {
  return caseRecord.checklist?.length ? caseRecord.checklist : getPlaceholderChecklistItems();
}

function getPlaceholderChecklistItems(): ChecklistItem[] {
  return checklistPlaceholders.map((label) => ({
    id: label,
    label,
    description: "Upload and process evidence to analyze this requirement.",
    matches: [],
    status: "MISSING",
    updatedAt: new Date().toISOString()
  }));
}

function getChecklistIcon(status: string) {
  if (isChecklistReady(status)) {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />;
  }

  if (status === "NEEDS_REVIEW") {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />;
  }

  return <Clock3 className="h-4 w-4 shrink-0 text-primary" />;
}

function formatChecklistStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
}

function getChecklistStatusVariant(status: string) {
  if (isChecklistReady(status)) {
    return "success";
  }

  if (status === "OPTIONAL") {
    return "secondary";
  }

  return "warning";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
