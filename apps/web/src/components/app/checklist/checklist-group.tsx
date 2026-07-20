import { AlertTriangle, CheckCircle2, CircleDashed, Clock3 } from "lucide-react";
import { ChecklistItemRow } from "@/components/app/checklist/checklist-item-row";
import type { ChecklistGroupKey } from "@/components/app/checklist/checklist-utils";
import type { ChecklistItem } from "@/lib/client/types";

const groupContent: Record<
  ChecklistGroupKey,
  { description: string; label: string }
> = {
  ready: {
    description: "Requirements supported by the current case evidence.",
    label: "Found"
  },
  missing: {
    description: "Required proof that still needs to be added.",
    label: "Missing"
  },
  review: {
    description: "Evidence that needs a quick accuracy check.",
    label: "Needs review"
  },
  optional: {
    description: "Helpful context that is not required for packet readiness.",
    label: "Optional"
  }
};

interface ChecklistGroupProps {
  expandedItemId: string | null;
  group: ChecklistGroupKey;
  items: ChecklistItem[];
  onSetCompleted: (itemId: string, completed: boolean) => Promise<void>;
  onToggleItem: (itemId: string) => void;
  updatingItemId: string | null;
}

export function ChecklistGroup({
  expandedItemId,
  group,
  items,
  onSetCompleted,
  onToggleItem,
  updatingItemId
}: ChecklistGroupProps) {
  if (!items.length) {
    return null;
  }

  const content = groupContent[group];

  return (
    <section
      aria-labelledby={`checklist-${group}-heading`}
      className="grid gap-3 border-t border-border pt-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className={getGroupIconClassName(group)}>
            <ChecklistGroupIcon group={group} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <h4
                id={`checklist-${group}-heading`}
                className="text-sm font-semibold uppercase tracking-normal text-foreground"
              >
                {content.label}
              </h4>
              <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {items.length}
              </span>
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {content.description}
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        {items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            isExpanded={expandedItemId === item.id}
            item={item}
            isUpdating={updatingItemId === item.id}
            onSetCompleted={(completed) => onSetCompleted(item.id, completed)}
            onToggle={() => onToggleItem(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ChecklistGroupIcon({ group }: { group: ChecklistGroupKey }) {
  if (group === "ready") {
    return <CheckCircle2 className="h-5 w-5" aria-hidden="true" />;
  }

  if (group === "review") {
    return <AlertTriangle className="h-5 w-5" aria-hidden="true" />;
  }

  if (group === "optional") {
    return <CircleDashed className="h-5 w-5" aria-hidden="true" />;
  }

  return <Clock3 className="h-5 w-5" aria-hidden="true" />;
}

function getGroupIconClassName(group: ChecklistGroupKey) {
  if (group === "ready") {
    return "text-teal-100";
  }

  if (group === "review") {
    return "text-amber-100";
  }

  if (group === "optional") {
    return "text-muted-foreground";
  }

  return "text-primary";
}
