import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  RotateCcw,
  UploadCloud
} from "lucide-react";
import {
  formatChecklistDateTime,
  formatChecklistStatus,
  getChecklistStatusVariant,
  isChecklistReady
} from "@/components/app/checklist/checklist-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface ChecklistItemRowProps {
  isExpanded: boolean;
  isUpdating: boolean;
  item: ChecklistItem;
  onSetCompleted: (completed: boolean) => Promise<void>;
  onToggle: () => void;
}

export function ChecklistItemRow({
  isExpanded,
  isUpdating,
  item,
  onSetCompleted,
  onToggle
}: ChecklistItemRowProps) {
  const firstMatch = item.matches?.[0];
  const isReady = isChecklistReady(item.status);
  const isMissing = item.status === "MISSING";
  const isManuallyCompleted = Boolean(item.manuallyCompletedAt);
  const canSetManualCompletion = !item.isPlaceholder && (isManuallyCompleted || !isReady);

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-secondary/35",
        isExpanded ? "border-primary/35 bg-primary/5" : null
      )}
    >
      <button
        aria-expanded={isExpanded}
        className="grid min-h-20 w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-3 rounded-md p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-24 md:grid-cols-[2.75rem_minmax(0,1fr)_auto_auto] md:items-center md:p-4"
        onClick={onToggle}
        type="button"
      >
        <span className={getChecklistIconContainerClassName(item.status)}>
          <ChecklistStatusIcon status={item.status} />
        </span>
        <span className="min-w-0">
          <span className="block break-words text-sm font-semibold leading-5 text-foreground md:text-base">
            {item.label}
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground md:text-sm">
            {firstMatch ? `Matched ${firstMatch.document.originalName}` : item.description}
          </span>
          <Badge className="mt-2 md:hidden" variant={getChecklistStatusVariant(item.status)}>
            {formatChecklistStatus(item.status)}
          </Badge>
        </span>
        <Badge
          className="hidden shrink-0 md:inline-flex"
          variant={getChecklistStatusVariant(item.status)}
        >
          {formatChecklistStatus(item.status)}
        </Badge>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform md:mt-0",
            isExpanded ? "rotate-180" : null
          )}
          aria-hidden="true"
        />
      </button>

      {isExpanded ? (
        <div className="grid gap-4 border-t border-border px-3 py-4 md:grid-cols-2 md:px-4">
          <section
            aria-label={`Requirement for ${item.label}`}
            className="grid content-start gap-2"
          >
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Requirement
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
          </section>

          {item.matches?.length ? (
            <section aria-label={`Matched evidence for ${item.label}`} className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                Matched evidence
              </p>
              {item.matches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-md border border-border bg-background/35 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <span className="min-w-0 break-words font-medium text-foreground">
                      {match.document.originalName}
                    </span>
                    <Badge className="shrink-0" variant="secondary">
                      {Math.round(match.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {match.rationale ?? "Matched by checklist analysis."}
                  </p>
                </div>
              ))}
            </section>
          ) : (
            <section
              aria-label={`Next action for ${item.label}`}
              className="grid content-start gap-2"
            >
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                {isManuallyCompleted ? "Completion" : "Next action"}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {isManuallyCompleted
                  ? "This item was marked complete manually. Reopen it if more support is still needed."
                  : item.status === "OPTIONAL"
                  ? "This item can strengthen the packet but is not required."
                  : "Add supporting evidence, then run Analyze evidence to check the requirement again."}
              </p>
              {isMissing ? (
                <Button asChild className="mt-1 w-full sm:w-fit" size="sm" variant="outline">
                  <a href="#evidence-intake">
                    <UploadCloud className="h-4 w-4" aria-hidden="true" />
                    Add evidence
                  </a>
                </Button>
              ) : null}
            </section>
          )}

          {canSetManualCompletion ? (
            <div className="flex border-t border-border pt-3 md:col-span-2">
              <Button
                className="w-full sm:w-fit"
                disabled={isUpdating}
                onClick={() => {
                  void onSetCompleted(!isManuallyCompleted);
                }}
                size="sm"
                type="button"
                variant={isManuallyCompleted ? "outline" : "secondary"}
              >
                {isManuallyCompleted ? (
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                {isUpdating
                  ? "Updating..."
                  : isManuallyCompleted
                    ? "Reopen item"
                    : "Mark complete"}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground md:col-span-2">
            <span>
              {isManuallyCompleted
                ? "Completed manually"
                : item.status === "OPTIONAL"
                ? "Optional supporting item"
                : isReady
                  ? "Ready for packet review"
                  : "Needs more support"}
            </span>
            <span>Updated {formatChecklistDateTime(item.updatedAt)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChecklistStatusIcon({ status }: { status: string }) {
  if (isChecklistReady(status)) {
    return <CheckCircle2 className="h-5 w-5" aria-hidden="true" />;
  }

  if (status === "NEEDS_REVIEW") {
    return <AlertTriangle className="h-5 w-5" aria-hidden="true" />;
  }

  if (status === "OPTIONAL") {
    return <CircleDashed className="h-5 w-5" aria-hidden="true" />;
  }

  return <Clock3 className="h-5 w-5" aria-hidden="true" />;
}

function getChecklistIconContainerClassName(status: string) {
  if (isChecklistReady(status)) {
    return "flex h-11 w-11 items-center justify-center rounded-md border border-teal-400/25 bg-teal-400/10 text-teal-100";
  }

  if (status === "NEEDS_REVIEW") {
    return "flex h-11 w-11 items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  if (status === "OPTIONAL") {
    return "flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground";
  }

  return "flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary";
}
