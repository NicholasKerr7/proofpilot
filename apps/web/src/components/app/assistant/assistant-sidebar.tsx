import {
  ChevronRight,
  Clock3,
  ListChecks,
  MessageSquareText,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import type {
  AssistantAction,
  AssistantCaseSummary
} from "@proofpilot/types";
import { formatCaseDate, formatCaseStatus } from "@/components/app/cases/case-utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const actionIcons: Record<AssistantAction["destinationId"], LucideIcon> = {
  "case-overview": MessageSquareText,
  "case-timeline": Clock3,
  "evidence-checklist": ListChecks,
  "evidence-intake": UploadCloud,
  "packet-export": MessageSquareText,
  "statement-builder": MessageSquareText
};

interface AssistantSidebarProps {
  actions: AssistantAction[];
  caseSummary: AssistantCaseSummary;
  isSending: boolean;
  onAction: (action: AssistantAction) => void;
  onPrompt: (prompt: string) => void;
  prompts: string[];
}

export function AssistantSidebar({
  actions,
  caseSummary,
  isSending,
  onAction,
  onPrompt,
  prompts
}: AssistantSidebarProps) {
  return (
    <aside className="grid min-w-0 content-start gap-4" aria-label="Assistant case context">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase text-primary">Case summary</h2>
        <Progress className="mt-4" label="Progress" value={caseSummary.progress} />
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-right font-medium text-foreground">
              {formatCaseStatus(caseSummary.status)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
            <dt className="text-muted-foreground">Deadline</dt>
            <dd className="text-right font-medium text-foreground">
              {caseSummary.deadline ? formatCaseDate(caseSummary.deadline) : "Not set"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
            <dt className="text-muted-foreground">Checklist</dt>
            <dd className="text-right font-medium text-foreground">
              {caseSummary.checklistReady} of {caseSummary.checklistTotal} ready
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase text-primary">Suggested next actions</h2>
        <div className="mt-3 grid gap-1">
          {actions.map((action) => {
            const Icon = actionIcons[action.destinationId];

            return (
              <button
                key={action.destinationId}
                className="group grid min-h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border-b border-border px-1 py-3 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onAction(action)}
                type="button"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {action.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {action.detail}
                  </span>
                  <span className="mt-1 block text-[11px] text-primary">{action.status}</span>
                </span>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase text-primary">Quick prompts</h2>
        <div className="mt-3 grid gap-2">
          {prompts.map((prompt) => (
            <Button
              key={prompt}
              className="h-auto min-h-11 justify-start whitespace-normal px-3 py-2 text-left font-normal"
              disabled={isSending}
              onClick={() => onPrompt(prompt)}
              size="sm"
              type="button"
              variant="outline"
            >
              {prompt}
            </Button>
          ))}
        </div>
      </section>
    </aside>
  );
}
