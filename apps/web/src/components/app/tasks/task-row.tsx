"use client";

import type { CaseTaskRecord } from "@proofpilot/types";
import { CalendarDays, Check, ChevronRight, UserRound } from "lucide-react";
import {
  formatTaskDueDate,
  getTaskPriorityLabel,
  getTaskPriorityVariant,
  getTaskStatusLabel,
  getTaskStatusVariant,
  isTaskOverdue
} from "@/components/app/tasks/task-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskRowProps {
  canEdit: boolean;
  isUpdating: boolean;
  onEdit: (task: CaseTaskRecord) => void;
  onToggleComplete: (task: CaseTaskRecord) => void;
  ownerName: string;
  task: CaseTaskRecord;
}

export function TaskRow({
  canEdit,
  isUpdating,
  onEdit,
  onToggleComplete,
  ownerName,
  task
}: TaskRowProps) {
  const completed = task.status === "COMPLETED";
  const overdue = isTaskOverdue(task);

  return (
    <article className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start gap-x-3 gap-y-2 border-b border-border px-3 py-4 last:border-b-0 xl:grid-cols-[2.75rem_minmax(14rem,1.4fr)_9rem_7rem_9rem_8rem_8rem_2.75rem] xl:items-center xl:px-4">
      <label
        className={cn(
          "relative flex h-11 w-11 items-center justify-center",
          canEdit && !isUpdating ? "cursor-pointer" : "cursor-not-allowed"
        )}
      >
        <input
          aria-label={`${completed ? "Reopen" : "Complete"} ${task.title}`}
          checked={completed}
          className="peer absolute inset-0 h-11 w-11 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          disabled={!canEdit || isUpdating}
          onChange={() => onToggleComplete(task)}
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex h-5 w-5 items-center justify-center rounded-sm border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
            completed
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground bg-background"
          )}
        >
          {completed ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
        </span>
      </label>

      <button
        className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:py-1"
        disabled={!canEdit}
        onClick={() => onEdit(task)}
        type="button"
      >
        <span className={cn("block break-words text-sm font-semibold", completed ? "line-through" : null)}>
          {task.title}
        </span>
        <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
          {task.description ?? task.case.title}
        </span>
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground xl:flex">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[10px] font-semibold text-orange-100">
          {getInitials(ownerName)}
        </span>
        <span className="truncate">{ownerName}</span>
      </div>

      <Badge className="hidden justify-self-start xl:inline-flex" variant={getTaskPriorityVariant(task.priority)}>
        {getTaskPriorityLabel(task.priority)}
      </Badge>

      <div className="hidden text-xs xl:block">
        <span className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          {formatTaskDueDate(task.dueAt)}
        </span>
        {overdue ? <span className="mt-1 block text-red-200">Overdue</span> : null}
      </div>

      <Badge className="hidden justify-self-start xl:inline-flex" variant={getTaskStatusVariant(task.status)}>
        {overdue ? "Overdue" : getTaskStatusLabel(task.status)}
      </Badge>

      <div className="hidden min-w-0 xl:block">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-8 text-right text-muted-foreground">{task.progress}%</span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
            <span
              className={cn(
                "block h-full rounded-full",
                completed ? "bg-teal-300" : "bg-primary",
                getProgressWidthClass(task.progress)
              )}
            />
          </span>
        </div>
      </div>

      <Button
        aria-label={`Edit ${task.title}`}
        className="col-start-3 row-start-1 xl:col-start-auto xl:row-start-auto"
        disabled={!canEdit}
        onClick={() => onEdit(task)}
        size="icon"
        title={`Edit ${task.title}`}
        type="button"
        variant="ghost"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-2 xl:hidden">
        <Badge variant={getTaskStatusVariant(task.status)}>
          {overdue ? "Overdue" : getTaskStatusLabel(task.status)}
        </Badge>
        <Badge variant={getTaskPriorityVariant(task.priority)}>
          {getTaskPriorityLabel(task.priority)}
        </Badge>
        <span className={cn("flex items-center gap-1 text-xs", overdue ? "text-red-200" : "text-muted-foreground")}>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {formatTaskDueDate(task.dueAt)}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          {task.progress}%
        </span>
      </div>
    </article>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "PP";
}

function getProgressWidthClass(progress: number) {
  if (progress >= 100) return "w-full";
  if (progress >= 90) return "w-11/12";
  if (progress >= 75) return "w-3/4";
  if (progress >= 60) return "w-3/5";
  if (progress >= 50) return "w-1/2";
  if (progress >= 40) return "w-2/5";
  if (progress >= 25) return "w-1/4";
  if (progress > 0) return "w-1/12";
  return "w-0";
}
