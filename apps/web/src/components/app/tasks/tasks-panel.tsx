"use client";

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
import { TaskEditor } from "@/components/app/tasks/task-editor";
import {
  TaskCaseHero,
  TaskFilterButton,
  TaskFilterControl,
  TaskMetric,
  TaskNoticeMessage
} from "@/components/app/tasks/tasks-panel-components";
import { TaskRow } from "@/components/app/tasks/task-row";
import {
  taskPriorityOptions,
  taskStatusOptions,
  type TaskPriorityFilter,
  type TaskSort,
  type TaskStatusFilter
} from "@/components/app/tasks/task-utils";
import { useTasksPanel } from "@/components/app/tasks/use-tasks-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import type { CaseRecord } from "@/lib/client/types";

interface TasksPanelProps {
  cases: CaseRecord[];
  onOpenCase: (caseId: string) => void;
  ownerName: string;
  selectedCase: CaseRecord | null;
}

/** Renders task workflow controls around the task data and mutation controller. */
export function TasksPanel({
  cases,
  onOpenCase,
  ownerName,
  selectedCase
}: TasksPanelProps) {
  const tasks = useTasksPanel({ cases, selectedCase });

  /** Applies a filter change and returns pagination to the first page. */
  function updateFilters(update: () => void) {
    update();
    tasks.setPage(1);
  }

  return (
    <section aria-labelledby="tasks-heading" className="grid gap-5">
      <header className="proof-page-header flex flex-wrap items-end justify-between gap-4">
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
          disabled={!tasks.editableCases.length}
          onClick={() => tasks.setEditorState({ mode: "create" })}
          type="button"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add task
        </Button>
      </header>

      {tasks.heroCase ? (
        <TaskCaseHero
          caseRecord={tasks.heroCase}
          onOpenCase={() => onOpenCase(tasks.heroCase?.id ?? "")}
        />
      ) : null}

      {tasks.notice ? <TaskNoticeMessage notice={tasks.notice} /> : null}

      {tasks.editorState ? (
        <TaskEditor
          cases={tasks.editableCases}
          initialCaseId={
            tasks.caseFilter !== "ALL"
              ? tasks.caseFilter
              : selectedCase?.id ?? tasks.editableCases[0]?.id ?? null
          }
          isBusy={tasks.updatingTaskId !== null}
          key={tasks.activeTask?.id ?? "new-task"}
          onCancel={() => tasks.setEditorState(null)}
          onDelete={tasks.deleteTask}
          onSave={tasks.saveTask}
          task={tasks.activeTask}
        />
      ) : null}

      <div className="grid gap-4">
        <div
          aria-label="Filter tasks by status"
          className="flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1 scroll-container"
          role="group"
        >
          <TaskFilterButton
            active={tasks.statusFilter === "ALL"}
            count={tasks.scopedTasks.length}
            label="All tasks"
            onClick={() => updateFilters(() => tasks.setStatusFilter("ALL"))}
          />
          {taskStatusOptions.map((option) => (
            <TaskFilterButton
              active={tasks.statusFilter === option.value}
              count={tasks.scopedTasks.filter((task) => task.status === option.value).length}
              key={option.value}
              label={option.label}
              onClick={() => updateFilters(() => tasks.setStatusFilter(option.value))}
            />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TaskFilterControl icon={FolderOpen} label="Case">
            <Select
              aria-label="Filter tasks by case"
              onChange={(event) =>
                updateFilters(() => tasks.setCaseFilter(event.target.value))
              }
              value={tasks.caseFilter}
            >
              <option value="ALL">All active cases</option>
              {cases.map((caseRecord) => (
                <option key={caseRecord.id} value={caseRecord.id}>
                  {caseRecord.title}
                </option>
              ))}
            </Select>
          </TaskFilterControl>

          <TaskFilterControl icon={AlertTriangle} label="Priority">
            <Select
              aria-label="Filter tasks by priority"
              onChange={(event) =>
                updateFilters(() =>
                  tasks.setPriorityFilter(event.target.value as TaskPriorityFilter)
                )
              }
              value={tasks.priorityFilter}
            >
              <option value="ALL">All priorities</option>
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </TaskFilterControl>

          <TaskFilterControl icon={Filter} label="Status">
            <Select
              aria-label="Filter tasks by status"
              onChange={(event) =>
                updateFilters(() =>
                  tasks.setStatusFilter(event.target.value as TaskStatusFilter)
                )
              }
              value={tasks.statusFilter}
            >
              <option value="ALL">All statuses</option>
              {taskStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </TaskFilterControl>

          <TaskFilterControl icon={Clock3} label="Sort">
            <Select
              aria-label="Sort tasks"
              onChange={(event) =>
                updateFilters(() => tasks.setSort(event.target.value as TaskSort))
              }
              value={tasks.sort}
            >
              <option value="DUE_ASC">Due date: soonest</option>
              <option value="DUE_DESC">Due date: latest</option>
              <option value="PRIORITY">Priority</option>
              <option value="UPDATED">Recently updated</option>
            </Select>
          </TaskFilterControl>
        </div>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-card md:grid-cols-5">
        <TaskMetric icon={ClipboardList} label="Total tasks" value={tasks.scopedTasks.length} />
        <TaskMetric
          icon={CheckCircle2}
          label="Completed"
          tone="success"
          value={tasks.completedCount}
        />
        <TaskMetric
          icon={RefreshCcw}
          label="In progress"
          tone="primary"
          value={tasks.inProgressCount}
        />
        <TaskMetric
          icon={FileCheck2}
          label="Not started"
          value={tasks.todoCount + tasks.reviewCount}
        />
        <TaskMetric
          icon={AlertTriangle}
          label="Overdue"
          tone="danger"
          value={tasks.overdueCount}
        />
      </dl>

      <section
        aria-labelledby="task-list-heading"
        className="overflow-hidden rounded-md border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold" id="task-list-heading">
              Task list
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {tasks.filteredTaskCount}{" "}
              {tasks.filteredTaskCount === 1 ? "task" : "tasks"} shown
            </p>
          </div>
          <Badge variant="secondary">{tasks.completion}% complete</Badge>
        </div>

        {tasks.isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            Loading tasks
          </div>
        ) : tasks.visibleTasks.length ? (
          <TaskRows
            canEditTask={tasks.canEditTask}
            onEdit={(taskId) => tasks.setEditorState({ mode: "edit", taskId })}
            onToggleComplete={(task) => {
              void tasks.toggleTaskComplete(task);
            }}
            ownerName={ownerName}
            updatingTaskId={tasks.updatingTaskId}
            visibleTasks={tasks.visibleTasks}
          />
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
          <Progress label="Tasks completed" value={tasks.completion} />
          <div className="flex items-center justify-between gap-2 md:justify-end">
            <span className="text-xs text-muted-foreground">
              Page {tasks.safePage} of {tasks.pageCount}
            </span>
            <Button
              aria-label="Previous task page"
              disabled={tasks.safePage <= 1}
              onClick={() =>
                tasks.setPage((currentPage) => Math.max(1, currentPage - 1))
              }
              size="icon"
              title="Previous task page"
              type="button"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Next task page"
              disabled={tasks.safePage >= tasks.pageCount}
              onClick={() =>
                tasks.setPage((currentPage) =>
                  Math.min(tasks.pageCount, currentPage + 1)
                )
              }
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

interface TaskRowsProps {
  canEditTask: (task: import("@proofpilot/types").CaseTaskRecord) => boolean;
  onEdit: (taskId: string) => void;
  onToggleComplete: (task: import("@proofpilot/types").CaseTaskRecord) => void;
  ownerName: string;
  updatingTaskId: string | null;
  visibleTasks: import("@proofpilot/types").CaseTaskRecord[];
}

/** Renders grouped compact rows and the wide desktop table from one task slice. */
function TaskRows({
  canEditTask,
  onEdit,
  onToggleComplete,
  ownerName,
  updatingTaskId,
  visibleTasks
}: TaskRowsProps) {
  return (
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
                  onEdit={(selectedTask) => onEdit(selectedTask.id)}
                  onToggleComplete={onToggleComplete}
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
            onEdit={(selectedTask) => onEdit(selectedTask.id)}
            onToggleComplete={onToggleComplete}
            ownerName={ownerName}
            task={task}
          />
        ))}
      </div>
    </>
  );
}
