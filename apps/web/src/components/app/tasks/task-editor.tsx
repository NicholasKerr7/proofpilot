"use client";

import { useState } from "react";
import type {
  CaseTaskPriority,
  CaseTaskRecord,
  CaseTaskStatus
} from "@proofpilot/types";
import { CalendarDays, Save, Trash2, X } from "lucide-react";
import {
  taskPriorityOptions,
  taskStatusOptions
} from "@/components/app/tasks/task-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CaseRecord } from "@/lib/client/types";

export interface TaskEditorSubmission {
  caseId: string;
  description: string | null;
  dueAt: string | null;
  priority: CaseTaskPriority;
  progress: number;
  status: CaseTaskStatus;
  title: string;
}

interface TaskEditorProps {
  cases: CaseRecord[];
  initialCaseId: string | null;
  isBusy: boolean;
  onCancel: () => void;
  onDelete: (taskId: string) => Promise<void>;
  onSave: (input: TaskEditorSubmission) => Promise<void>;
  task: CaseTaskRecord | null;
}

export function TaskEditor({
  cases,
  initialCaseId,
  isBusy,
  onCancel,
  onDelete,
  onSave,
  task
}: TaskEditorProps) {
  const [caseId, setCaseId] = useState(task?.caseId ?? initialCaseId ?? cases[0]?.id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueAt ?? null));
  const [priority, setPriority] = useState<CaseTaskPriority>(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<CaseTaskStatus>(task?.status ?? "TODO");
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();

    if (!caseId) {
      setValidationMessage("Choose a case for this task.");
      return;
    }

    if (!normalizedTitle) {
      setValidationMessage("Enter a task title.");
      return;
    }

    setValidationMessage(null);
    await onSave({
      caseId,
      description: description.trim() || null,
      dueAt: dueDate ? new Date(`${dueDate}T12:00:00.000Z`).toISOString() : null,
      priority,
      progress,
      status,
      title: normalizedTitle
    });
  }

  function handleStatusChange(nextStatus: CaseTaskStatus) {
    setStatus(nextStatus);

    if (nextStatus === "COMPLETED") {
      setProgress(100);
    } else if (nextStatus === "TODO") {
      setProgress(0);
    } else if (nextStatus === "IN_PROGRESS" && (progress === 0 || progress === 100)) {
      setProgress(25);
    } else if (nextStatus === "REVIEW" && (progress < 75 || progress === 100)) {
      setProgress(90);
    }
  }

  return (
    <section
      aria-labelledby="task-editor-heading"
      className="grid gap-5 rounded-md border border-primary/35 bg-card p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            {task ? "Task detail" : "New task"}
          </p>
          <h2 className="mt-1 text-lg font-semibold" id="task-editor-heading">
            {task ? "Edit task" : "Add a case task"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track one clear action, its priority, due date, and current progress.
          </p>
        </div>
        <Button
          aria-label="Close task editor"
          onClick={onCancel}
          size="icon"
          title="Close task editor"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {validationMessage ? (
        <p
          className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
          role="alert"
        >
          {validationMessage}
        </p>
      ) : null}

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="task-case">Case</Label>
            <Select
              disabled={Boolean(task)}
              id="task-case"
              onChange={(event) => setCaseId(event.target.value)}
              value={caseId}
            >
              <option value="">Choose a case</option>
              {cases.map((caseRecord) => (
                <option key={caseRecord.id} value={caseRecord.id}>
                  {caseRecord.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="task-title">Task</Label>
            <Input
              autoFocus
              id="task-title"
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Upload proof of identity"
              value={title}
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add the context needed to complete this task."
              value={description}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
              onChange={(event) => setPriority(event.target.value as CaseTaskPriority)}
              value={priority}
            >
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-status">Status</Label>
            <Select
              id="task-status"
              onChange={(event) => handleStatusChange(event.target.value as CaseTaskStatus)}
              value={status}
            >
              {taskStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-due-date">Due date</Label>
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="pl-10"
                id="task-due-date"
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="task-progress">Progress</Label>
              <output className="text-sm font-semibold text-primary" htmlFor="task-progress">
                {progress}%
              </output>
            </div>
            <input
              aria-label="Task progress"
              className="h-11 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "COMPLETED"}
              id="task-progress"
              max={status === "COMPLETED" ? 100 : 99}
              min={0}
              onChange={(event) => setProgress(Number(event.target.value))}
              step={5}
              type="range"
              value={progress}
            />
          </div>
        </div>

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[auto_1fr_auto]">
          {task ? (
            isConfirmingDelete ? (
              <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                <Button
                  disabled={isBusy}
                  onClick={() => setIsConfirmingDelete(false)}
                  type="button"
                  variant="outline"
                >
                  Keep task
                </Button>
                <Button
                  className="border-red-400/40 text-red-100 hover:bg-red-400/10"
                  disabled={isBusy}
                  onClick={() => void onDelete(task.id)}
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </Button>
              </div>
            ) : (
              <Button
                disabled={isBusy}
                onClick={() => setIsConfirmingDelete(true)}
                type="button"
                variant="outline"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <span className="hidden sm:block" />
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isBusy} onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isBusy} type="submit">
              <Save className="h-4 w-4" aria-hidden="true" />
              {isBusy ? "Saving..." : task ? "Save task" : "Add task"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function toDateInputValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}
