"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, Inbox, ListFilter, ListChecks } from "lucide-react";
import { ChecklistGroup } from "@/components/app/checklist/checklist-group";
import {
  getChecklistGroupKey,
  isChecklistReady,
  matchesChecklistFilter,
  type ChecklistFilter,
  type ChecklistGroupKey
} from "@/components/app/checklist/checklist-utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ChecklistItem } from "@/lib/client/types";

const checklistGroupOrder: ChecklistGroupKey[] = ["missing", "review", "ready", "optional"];
const checklistFilters: Array<{ label: string; value: ChecklistFilter }> = [
  { label: "All", value: "all" },
  { label: "Missing", value: "missing" },
  { label: "Review", value: "review" },
  { label: "Ready", value: "ready" },
  { label: "Optional", value: "optional" }
];

interface ChecklistWorkspaceProps {
  expandedItemId: string | null;
  items: ChecklistItem[];
  onSetCompleted: (itemId: string, completed: boolean) => Promise<void>;
  onToggleItem: (itemId: string) => void;
  updatingItemId: string | null;
}

export function ChecklistWorkspace({
  expandedItemId,
  items,
  onSetCompleted,
  onToggleItem,
  updatingItemId
}: ChecklistWorkspaceProps) {
  const [filter, setFilter] = useState<ChecklistFilter>("all");
  const groupedItems = groupChecklistItems(items);
  const readyCount = items.filter((item) => isChecklistReady(item.status)).length;
  const missingCount = groupedItems.missing.length;
  const reviewCount = groupedItems.review.length;
  const completion = items.length ? Math.round((readyCount / items.length) * 100) : 0;
  const filteredItems = items.filter((item) => matchesChecklistFilter(item.status, filter));
  const visibleGroups = checklistGroupOrder.filter(
    (group) => filter === "all" || group === filter
  );

  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="checklist-progress-heading"
        className="grid gap-4 border-y border-border py-4"
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.4fr)] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-primary">
              Checklist progress
            </p>
            <h4
              id="checklist-progress-heading"
              className="mt-1 text-lg font-semibold text-foreground"
            >
              Missing evidence checklist
            </h4>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Close required gaps and review evidence matches before packet generation.
            </p>
          </div>
          <Progress value={completion} label="Requirements ready" />
        </div>

        <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ChecklistMetric icon="total" label="Total items" value={items.length} />
          <ChecklistMetric icon="ready" label="Ready" value={readyCount} />
          <ChecklistMetric icon="missing" label="Missing" value={missingCount} />
          <ChecklistMetric icon="review" label="Needs review" value={reviewCount} />
        </dl>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div className="grid gap-4">
          <section aria-labelledby="evidence-tasks-heading" className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="flex items-start gap-2">
                <ListFilter aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground" id="evidence-tasks-heading">
                    Evidence tasks
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filteredItems.length} of {items.length} requirements shown
                  </p>
                </div>
              </div>
              <div
                aria-label="Filter evidence tasks"
                className="grid grid-cols-2 gap-1 rounded-md border border-border bg-secondary/25 p-1 sm:grid-cols-5"
                role="group"
              >
                {checklistFilters.map((item) => {
                  const count =
                    item.value === "all"
                      ? items.length
                      : groupedItems[item.value].length;

                  return (
                    <Button
                      aria-pressed={filter === item.value}
                      key={item.value}
                      onClick={() => setFilter(item.value)}
                      size="sm"
                      type="button"
                      variant={filter === item.value ? "secondary" : "ghost"}
                    >
                      {item.label}
                      <span className="rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {count}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </section>

          {filteredItems.length ? (
            <div className="grid gap-5">
              {visibleGroups.map((group) => (
                <ChecklistGroup
                  key={group}
                  expandedItemId={expandedItemId}
                  group={group}
                  items={groupedItems[group]}
                  onSetCompleted={onSetCompleted}
                  onToggleItem={onToggleItem}
                  updatingItemId={updatingItemId}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-32 place-items-center border-y border-dashed border-border px-4 py-8 text-center">
              <div>
                <Inbox aria-hidden="true" className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No requirements match this task filter.
                </p>
              </div>
            </div>
          )}
        </div>

        <ChecklistSummary
          completion={completion}
          focusItem={groupedItems.missing[0] ?? groupedItems.review[0] ?? null}
          missingCount={missingCount}
          readyCount={readyCount}
          reviewCount={reviewCount}
          totalCount={items.length}
        />
      </div>
    </div>
  );
}

function ChecklistSummary({
  completion,
  focusItem,
  missingCount,
  readyCount,
  reviewCount,
  totalCount
}: {
  completion: number;
  focusItem: ChecklistItem | null;
  missingCount: number;
  readyCount: number;
  reviewCount: number;
  totalCount: number;
}) {
  return (
    <aside className="hidden gap-3 xl:grid" aria-label="Checklist summary">
      <section className="rounded-md border border-border bg-secondary/25 p-4">
        <h4 className="text-xs font-semibold uppercase text-primary">Readiness summary</h4>
        <p className="mt-3 text-3xl font-semibold text-foreground">{completion}%</p>
        <Progress className="mt-3" value={completion} label="Requirements ready" />
        <dl className="mt-4 divide-y divide-border text-sm">
          <SummaryRow label="Ready" value={`${readyCount} of ${totalCount}`} />
          <SummaryRow label="Missing" value={String(missingCount)} />
          <SummaryRow label="Needs review" value={String(reviewCount)} />
        </dl>
      </section>

      <section className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <h4 className="text-xs font-semibold uppercase text-primary">Suggested next step</h4>
        <p className="mt-3 text-sm font-semibold leading-6 text-foreground">
          {focusItem?.label ?? "Review the completed checklist"}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {focusItem?.description ?? "Every required item has evidence ready for final review."}
        </p>
      </section>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ChecklistMetric({
  icon,
  label,
  value
}: {
  icon: "total" | "ready" | "missing" | "review";
  label: string;
  value: number;
}) {
  return (
    <div className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border border-border bg-secondary/25 p-3">
      <span className="text-primary">
        {icon === "total" ? <ListChecks className="h-5 w-5" aria-hidden="true" /> : null}
        {icon === "ready" ? <CheckCircle2 className="h-5 w-5 text-teal-100" aria-hidden="true" /> : null}
        {icon === "missing" ? <FileCheck2 className="h-5 w-5" aria-hidden="true" /> : null}
        {icon === "review" ? <AlertTriangle className="h-5 w-5 text-amber-100" aria-hidden="true" /> : null}
      </span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-lg font-semibold text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function groupChecklistItems(items: ChecklistItem[]) {
  const groups: Record<ChecklistGroupKey, ChecklistItem[]> = {
    ready: [],
    missing: [],
    review: [],
    optional: []
  };

  for (const item of items) {
    groups[getChecklistGroupKey(item.status)].push(item);
  }

  return groups;
}
