"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { ChecklistWorkspace } from "@/components/app/checklist/checklist-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type LoadedChecklist = {
  caseId: string;
  revision: string;
  items: ChecklistItem[];
};

const checklistPlaceholders = [
  "Closure or restriction screenshot",
  "Support conversation",
  "Account ownership proof",
  "Transaction or activity context"
];

export function ChecklistPanel({ onCaseChanged, selectedCase }: ChecklistPanelProps) {
  const initialItems = getChecklistItems(selectedCase);
  const selectedCaseId = selectedCase.id;
  const selectedChecklistRevision = getChecklistRevision(selectedCase.checklist ?? []);
  const [loadedChecklist, setLoadedChecklist] = useState<LoadedChecklist | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(() =>
    getDefaultExpandedItemId(initialItems)
  );
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
  const [isAnalyzingChecklist, setIsAnalyzingChecklist] = useState(false);
  const [checklistNotice, setChecklistNotice] = useState<ChecklistNotice | null>(null);
  const checklistItems =
    loadedChecklist?.caseId === selectedCaseId &&
    loadedChecklist.revision === selectedChecklistRevision
      ? loadedChecklist.items
      : initialItems;

  useEffect(() => {
    let isMounted = true;

    async function loadChecklist() {
      setIsLoadingChecklist(true);

      try {
        const nextItems = await apiRequest<ChecklistItem[]>(
          `/api/cases/${selectedCaseId}/checklist`
        );

        if (isMounted) {
          const displayItems = nextItems.length ? nextItems : getPlaceholderChecklistItems();
          setLoadedChecklist({
            caseId: selectedCaseId,
            items: displayItems,
            revision: selectedChecklistRevision
          });
          setExpandedItemId((currentId) =>
            currentId && displayItems.some((item) => item.id === currentId)
              ? currentId
              : getDefaultExpandedItemId(displayItems)
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
  }, [selectedCaseId, selectedChecklistRevision]);

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
      setLoadedChecklist({
        caseId: selectedCaseId,
        items: nextItems,
        revision: getChecklistRevision(updatedCase.checklist ?? [])
      });
      setExpandedItemId((currentId) =>
        currentId && nextItems.some((item) => item.id === currentId)
          ? currentId
          : getDefaultExpandedItemId(nextItems)
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

  return (
    <Card id="evidence-checklist" className="scroll-mt-28 lg:scroll-mt-24">
      <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div>
          <CardTitle>Evidence checklist</CardTitle>
          <CardDescription>Review missing proof and matched evidence.</CardDescription>
        </div>
        <Button
          disabled={isAnalyzingChecklist}
          onClick={() => {
            void handleAnalyzeChecklist();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {isAnalyzingChecklist ? "Analyzing..." : "Analyze evidence"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        {checklistNotice ? (
          <p
            className={
              checklistNotice.tone === "success"
                ? "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100"
                : "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            }
            role={checklistNotice.tone === "error" ? "alert" : "status"}
          >
            {checklistNotice.text}
          </p>
        ) : null}

        {isLoadingChecklist ? (
          <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            Loading checklist details...
          </p>
        ) : null}

        <ChecklistWorkspace
          expandedItemId={expandedItemId}
          items={checklistItems}
          onToggleItem={(itemId) =>
            setExpandedItemId((currentId) => (currentId === itemId ? null : itemId))
          }
        />
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

function getDefaultExpandedItemId(items: ChecklistItem[]) {
  return (
    items.find((item) => item.status === "MISSING" || item.status === "NEEDS_REVIEW")?.id ??
    items[0]?.id ??
    null
  );
}

function getChecklistRevision(items: ChecklistItem[]) {
  return items
    .map((item) => `${item.id}:${item.status}:${item.updatedAt}:${item.matches?.length ?? 0}`)
    .join("|");
}
