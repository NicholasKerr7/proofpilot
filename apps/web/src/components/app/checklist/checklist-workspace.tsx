import { AlertTriangle, CheckCircle2, FileCheck2, ListChecks } from "lucide-react";
import { ChecklistGroup } from "@/components/app/checklist/checklist-group";
import {
  getChecklistGroupKey,
  isChecklistReady,
  type ChecklistGroupKey
} from "@/components/app/checklist/checklist-utils";
import { Progress } from "@/components/ui/progress";
import type { ChecklistItem } from "@/lib/client/types";

const checklistGroupOrder: ChecklistGroupKey[] = ["missing", "review", "ready", "optional"];

interface ChecklistWorkspaceProps {
  expandedItemId: string | null;
  items: ChecklistItem[];
  onToggleItem: (itemId: string) => void;
}

export function ChecklistWorkspace({
  expandedItemId,
  items,
  onToggleItem
}: ChecklistWorkspaceProps) {
  const groupedItems = groupChecklistItems(items);
  const readyCount = items.filter((item) => isChecklistReady(item.status)).length;
  const missingCount = groupedItems.missing.length;
  const reviewCount = groupedItems.review.length;
  const completion = items.length ? Math.round((readyCount / items.length) * 100) : 0;

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

      <div className="grid gap-5">
        {checklistGroupOrder.map((group) => (
          <ChecklistGroup
            key={group}
            expandedItemId={expandedItemId}
            group={group}
            items={groupedItems[group]}
            onToggleItem={onToggleItem}
          />
        ))}
      </div>
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
