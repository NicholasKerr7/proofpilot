"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CaseTaskRecord,
  CreateCaseTaskInput,
  UpdateCaseTaskInput
} from "@proofpilot/types";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  Filter,
  FolderOpen,
  LoaderCircle,
  Plus,
  RefreshCcw
} from "lucide-react";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseReadiness,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  TaskEditor,
  type TaskEditorSubmission
} from "@/components/app/tasks/task-editor";
import { TaskRow } from "@/components/app/tasks/task-row";
import {
  isTaskOverdue,
  sortTasks,
  taskPriorityOptions,
  taskStatusOptions,
  type TaskPriorityFilter,
  type TaskSort,
  type TaskStatusFilter
} from "@/components/app/tasks/task-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

const tasksPerPage = 10;

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; taskId: string }
  | null;

type Notice = {
  text: string;
  tone: "error" | "success";
};

interface TasksPanelProps {
  cases: CaseRecord[];
  onOpenCase: (caseId: string) => void;
  ownerName: string;
  selectedCase: CaseRecord | null;
}

export function TasksPanel({
  cases,
  onOpenCase,
  ownerName,
  selectedCase
}: TasksPanelProps) {
  const [tasks, setTasks] = useState<CaseTaskRecord[]>([]);
  const [caseFilter, setCaseFilter] = useState(selectedCase?.id ?? "ALL");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>("ALL");
  const [sort, setSort] = useState<TaskSort>("DUE_ASC");
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [page, setPage] = useState(1);
  const editableCases = cases.filter((caseRecord) => caseRecord.access?.canEdit !== false);
  const activeTask =
    editorState?.mode === "edit"
      ? tasks.find((task) => task.id === editorState.taskId) ?? null
      : null;
  const heroCase =
    caseFilter === "ALL"
      ? selectedCase
      : cases.find((caseRecord) => caseRecord.id === caseFilter) ?? selectedCase;

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextTasks = await apiRequest<CaseTaskRecord[]>("/api/tasks");

        if (isMounted) {
          setTasks(nextTasks);
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Tasks could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTasks = useMemo(() => {
    const matchingTasks = tasks.filter(
      (task) =>
        (caseFilter === "ALL" || task.caseId === caseFilter) &&
        (statusFilter === "ALL" || task.status === statusFilter) &&
        (priorityFilter === "ALL" || task.priority === priorityFilter)
    );

    return sortTasks(matchingTasks, sort);
  }, [caseFilter, priorityFilter, sort, statusFilter, tasks]);
  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / tasksPerPage));
  const safePage = Math.min(page, pageCount);
  const visibleTasks = filteredTasks.slice(
    (safePage - 1) * tasksPerPage,
    safePage * tasksPerPage
  );
  const scopedTasks = tasks.filter((task) => caseFilter === "ALL" || task.caseId === caseFilter);
  const completedCount = scopedTasks.filter((task) => task.status === "COMPLETED").length;
  const inProgressCount = scopedTasks.filter((task) => task.status === "IN_PROGRESS").length;
  const todoCount = scopedTasks.filter((task) => task.status === "TODO").length;
  const reviewCount = scopedTasks.filter((task) => task.status === "REVIEW").length;
  const overdueCount = scopedTasks.filter((task) => isTaskOverdue(task)).length;
  const completion = scopedTasks.length
    ? Math.round((completedCount / scopedTasks.length) * 100)
    : 0;

  function updateFilters(update: () => void) {
    update();
    setPage(1);
  }

  function canEditTask(task: CaseTaskRecord) {
    const taskCase = cases.find((caseRecord) => caseRecord.id === task.caseId);

    return Boolean(taskCase && (taskCase.access?.canEdit ?? true));
  }

  async function handleSave(input: TaskEditorSubmission) {
    setUpdatingTaskId(activeTask?.id ?? "new");
    setNotice(null);

    try {
      if (activeTask) {
        const payload: UpdateCaseTaskInput = {
          description: input.description,
          dueAt: input.dueAt,
          priority: input.priority,
          progress: input.progress,
          status: input.status,
          title: input.title
        };
        const updatedTask = await apiRequest<CaseTaskRecord>(
          `/api/tasks/${activeTask.id}`,
          { body: JSON.stringify(payload), method: "PATCH" }
        );
        setTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
        );
        setNotice({ tone: "success", text: "Task updated." });
      } else {
        const payload: CreateCaseTaskInput = {
          priority: input.priority,
          progress: input.progress,
          status: input.status,
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          ...(input.dueAt ? { dueAt: input.dueAt } : {})
        };
        const createdTask = await apiRequest<CaseTaskRecord>(
          `/api/cases/${input.caseId}/tasks`,
          { body: JSON.stringify(payload), method: "POST" }
        );
        setTasks((currentTasks) => [createdTask, ...currentTasks]);
        setCaseFilter(input.caseId);
        setNotice({ tone: "success", text: "Task added." });
      }

      setEditorState(null);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Task could not be saved."
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleDelete(taskId: string) {
    setUpdatingTaskId(taskId);
    setNotice(null);

    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
      setEditorState(null);
      setNotice({ tone: "success", text: "Task deleted." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Task could not be deleted."
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleToggleComplete(task: CaseTaskRecord) {
    setUpdatingTaskId(task.id);
    setNotice(null);

    try {
      const completed = task.status !== "COMPLETED";
      const updatedTask = await apiRequest<CaseTaskRecord>(`/api/tasks/${task.id}`, {
        body: JSON.stringify({
          progress: completed ? 100 : 0,
          status: completed ? "COMPLETED" : "TODO"
        } satisfies UpdateCaseTaskInput),
        method: "PATCH"
      });
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === updatedTask.id ? updatedTask : currentTask
        )
      );
      setNotice({
        tone: "success",
        text: completed ? "Task completed." : "Task reopened."
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Task could not be updated."
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <section aria-labelledby="tasks-heading" className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Case workflow</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="tasks-heading">
            Tasks
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Track and complete the steps needed to build a stronger appeal.
          </p>
        </div>
        <Button
          disabled={!editableCases.length}
          onClick={() => setEditorState({ mode: "create" })}
          type="button"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add task
        </Button>
      </header>

      {heroCase ? (
        <TaskCaseHero caseRecord={heroCase} onOpenCase={() => onOpenCase(heroCase.id)} />
      ) : null}

      {notice ? (
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
      ) : null}

      {editorState ? (
        <TaskEditor
          cases={editableCases}
          initialCaseId={
            caseFilter !== "ALL" ? caseFilter : selectedCase?.id ?? editableCases[0]?.id ?? null
          }
          isBusy={updatingTaskId !== null}
          key={activeTask?.id ?? "new-task"}
          onCancel={() => setEditorState(null)}
          onDelete={handleDelete}
          onSave={handleSave}
          task={activeTask}
        />
      ) : null}

      <div className="grid gap-4">
        <div
          aria-label="Filter tasks by status"
          className="flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1 scroll-container"
          role="group"
        >
          <TaskFilterButton
            active={statusFilter === "ALL"}
            count={scopedTasks.length}
            label="All tasks"
            onClick={() => updateFilters(() => setStatusFilter("ALL"))}
          />
          {taskStatusOptions.map((option) => (
            <TaskFilterButton
              active={statusFilter === option.value}
              count={scopedTasks.filter((task) => task.status === option.value).length}
              key={option.value}
              label={option.label}
              onClick={() => updateFilters(() => setStatusFilter(option.value))}
            />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterControl icon={FolderOpen} label="Case">
            <Select
              aria-label="Filter tasks by case"
              onChange={(event) => updateFilters(() => setCaseFilter(event.target.value))}
              value={caseFilter}
            >
              <option value="ALL">All active cases</option>
              {cases.map((caseRecord) => (
                <option key={caseRecord.id} value={caseRecord.id}>
                  {caseRecord.title}
                </option>
              ))}
            </Select>
          </FilterControl>

          <FilterControl icon={AlertTriangle} label="Priority">
            <Select
              aria-label="Filter tasks by priority"
              onChange={(event) =>
                updateFilters(() => setPriorityFilter(event.target.value as TaskPriorityFilter))
              }
              value={priorityFilter}
            >
              <option value="ALL">All priorities</option>
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterControl>

          <FilterControl icon={Filter} label="Status">
            <Select
              aria-label="Filter tasks by status"
              onChange={(event) =>
                updateFilters(() => setStatusFilter(event.target.value as TaskStatusFilter))
              }
              value={statusFilter}
            >
              <option value="ALL">All statuses</option>
              {taskStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterControl>

          <FilterControl icon={Clock3} label="Sort">
            <Select
              aria-label="Sort tasks"
              onChange={(event) => updateFilters(() => setSort(event.target.value as TaskSort))}
              value={sort}
            >
              <option value="DUE_ASC">Due date: soonest</option>
              <option value="DUE_DESC">Due date: latest</option>
              <option value="PRIORITY">Priority</option>
              <option value="UPDATED">Recently updated</option>
            </Select>
          </FilterControl>
        </div>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-card md:grid-cols-5">
        <TaskMetric icon={ClipboardList} label="Total tasks" value={scopedTasks.length} />
        <TaskMetric icon={CheckCircle2} label="Completed" tone="success" value={completedCount} />
        <TaskMetric icon={RefreshCcw} label="In progress" tone="primary" value={inProgressCount} />
        <TaskMetric icon={FileCheck2} label="Not started" value={todoCount + reviewCount} />
        <TaskMetric icon={AlertTriangle} label="Overdue" tone="danger" value={overdueCount} />
      </dl>

      <section aria-labelledby="task-list-heading" className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold" id="task-list-heading">
              Task list
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"} shown
            </p>
          </div>
          <Badge variant="secondary">{completion}% complete</Badge>
        </div>

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            Loading tasks
          </div>
        ) : visibleTasks.length ? (
          <>
            <div className="xl:hidden">
              {taskPriorityOptions.map((priority) => {
                const matchingTasks = visibleTasks.filter(
                  (task) => task.priority === priority.value
                );

                if (!matchingTasks.length) {
                  return null;
                }

                return (
                  <section aria-label={`${priority.label} priority tasks`} key={priority.value}>
                    <div className="border-b border-border bg-secondary/20 px-4 py-2 text-xs font-semibold uppercase text-primary">
                      {priority.label} priority
                    </div>
                    {matchingTasks.map((task) => (
                      <TaskRow
                        canEdit={canEditTask(task)}
                        isUpdating={updatingTaskId === task.id}
                        key={task.id}
                        onEdit={(selectedTask) =>
                          setEditorState({ mode: "edit", taskId: selectedTask.id })
                        }
                        onToggleComplete={(selectedTask) => {
                          void handleToggleComplete(selectedTask);
                        }}
                        ownerName={ownerName}
                        task={task}
                      />
                    ))}
                  </section>
                );
              })}
            </div>

            <div className="hidden xl:block">
              <div className="grid grid-cols-[2.75rem_minmax(14rem,1.4fr)_9rem_7rem_9rem_8rem_8rem_2.75rem] items-center gap-x-3 border-b border-border bg-secondary/20 px-4 py-2 text-xs text-muted-foreground">
                <span />
                <span>Task</span>
                <span>Assignee</span>
                <span>Priority</span>
                <span>Due date</span>
                <span>Status</span>
                <span>Progress</span>
                <span />
              </div>
              {visibleTasks.map((task) => (
                <TaskRow
                  canEdit={canEditTask(task)}
                  isUpdating={updatingTaskId === task.id}
                  key={task.id}
                  onEdit={(selectedTask) =>
                    setEditorState({ mode: "edit", taskId: selectedTask.id })
                  }
                  onToggleComplete={(selectedTask) => {
                    void handleToggleComplete(selectedTask);
                  }}
                  ownerName={ownerName}
                  task={task}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-48 place-items-center px-6 py-10 text-center">
            <div className="max-w-sm">
              <ClipboardList className="mx-auto h-7 w-7 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold">No tasks match these filters</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Clear a filter or add a task to the active case.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-3 border-t border-border px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <Progress label="Tasks completed" value={completion} />
          <div className="flex items-center justify-between gap-2 md:justify-end">
            <span className="text-xs text-muted-foreground">
              Page {safePage} of {pageCount}
            </span>
            <Button
              aria-label="Previous task page"
              disabled={safePage <= 1}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              size="icon"
              title="Previous task page"
              type="button"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Next task page"
              disabled={safePage >= pageCount}
              onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))}
              size="icon"
              title="Next task page"
              type="button"
              variant="outline"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}

function TaskCaseHero({
  caseRecord,
  onOpenCase
}: {
  caseRecord: CaseRecord;
  onOpenCase: () => void;
}) {
  const readiness = getCaseReadiness(caseRecord);

  return (
    <section className="proof-accent-frame grid gap-5 rounded-md border border-primary/35 bg-card p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-6">
      <CaseProgressRing className="mx-auto md:mx-0" size="compact" value={readiness} />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-primary">Primary case</p>
        <h2 className="mt-2 break-words text-lg font-semibold md:text-xl">{caseRecord.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{formatCaseReference(caseRecord)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {caseRecord.deadline ? <span>Deadline {formatCaseDate(caseRecord.deadline)}</span> : null}
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

function TaskFilterButton({
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

function FilterControl({
  children,
  icon: Icon,
  label
}: {
  children: React.ReactNode;
  icon: typeof Filter;
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

function TaskMetric({
  icon: Icon,
  label,
  tone = "muted",
  value
}: {
  icon: typeof ClipboardList;
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
