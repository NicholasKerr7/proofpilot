import { ArrowRight, type LucideIcon } from "lucide-react";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseCompletenessScore,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import type { TaskNotice } from "@/components/app/tasks/use-tasks-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

/** Renders the active task case with completeness and status context. */
export function TaskCaseHero({
  caseRecord,
  onOpenCase
}: {
  caseRecord: CaseRecord;
  onOpenCase: () => void;
}) {
  const completeness = getCaseCompletenessScore(caseRecord);

  return (
    <section className="proof-accent-frame grid gap-5 rounded-md border border-primary/35 bg-card p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-6">
      <CaseProgressRing
        className="mx-auto md:mx-0"
        label="Completeness"
        size="compact"
        value={completeness}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-primary">Primary case</p>
        <h2 className="mt-2 break-words text-lg font-semibold md:text-xl">
          {caseRecord.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatCaseReference(caseRecord)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {caseRecord.deadline ? (
            <span>Deadline {formatCaseDate(caseRecord.deadline)}</span>
          ) : null}
          <Badge variant={getCaseStatusVariant(caseRecord.status)}>
            {formatCaseStatus(caseRecord.status)}
          </Badge>
        </div>
      </div>
      <Button onClick={onOpenCase} type="button" variant="outline">
        Case overview
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </section>
  );
}

/** Renders one status-filter segment with its scoped task count. */
export function TaskFilterButton({
  active,
  count,
  label,
  onClick
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-pressed={active}
      className="shrink-0"
      onClick={onClick}
      size="sm"
      type="button"
      variant={active ? "secondary" : "ghost"}
    >
      {label}
      <span className="rounded-md border border-border bg-background/35 px-1.5 py-0.5 text-[10px]">
        {count}
      </span>
    </Button>
  );
}

/** Labels a task filter control with a consistent icon treatment. */
export function TaskFilterControl({
  children,
  icon: Icon,
  label
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-medium text-muted-foreground">
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {label}
      </span>
      {children}
    </label>
  );
}

/** Renders one aggregate task metric. */
export function TaskMetric({
  icon: Icon,
  label,
  tone = "muted",
  value
}: {
  icon: LucideIcon;
  label: string;
  tone?: "danger" | "muted" | "primary" | "success";
  value: number;
}) {
  return (
    <div className="grid min-h-24 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-r border-border p-3 even:border-r-0 last:col-span-2 last:border-b-0 last:border-r-0 md:border-b-0 md:border-r md:even:border-r md:last:col-span-1 md:last:border-r-0">
      <dt className="col-span-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-xs uppercase text-muted-foreground">
        <Icon
          className={cn(
            "h-5 w-5",
            tone === "danger" ? "text-red-200" : null,
            tone === "primary" ? "text-primary" : null,
            tone === "success" ? "text-teal-200" : null
          )}
          aria-hidden="true"
        />
        {label}
      </dt>
      <dd className="col-start-2 text-2xl font-semibold">{value}</dd>
    </div>
  );
}

/** Renders mutation feedback with an accessible semantic role. */
export function TaskNoticeMessage({ notice }: { notice: TaskNotice }) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        notice.tone === "success"
          ? "border-teal-400/30 bg-teal-400/10 text-teal-100"
          : "border-red-400/30 bg-red-400/10 text-red-100"
      )}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      {notice.text}
    </p>
  );
}
