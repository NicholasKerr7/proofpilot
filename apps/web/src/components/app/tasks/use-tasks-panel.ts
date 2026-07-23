"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CaseTaskRecord,
  CreateCaseTaskInput,
  UpdateCaseTaskInput
} from "@proofpilot/types";
import type { TaskEditorSubmission } from "@/components/app/tasks/task-editor";
import {
  isTaskOverdue,
  sortTasks,
  type TaskPriorityFilter,
  type TaskSort,
  type TaskStatusFilter
} from "@/components/app/tasks/task-utils";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

const tasksPerPage = 10;

export type TaskEditorState =
  | { mode: "create" }
  | { mode: "edit"; taskId: string }
  | null;

export interface TaskNotice {
  text: string;
  tone: "error" | "success";
}

interface UseTasksPanelInput {
  cases: CaseRecord[];
  selectedCase: CaseRecord | null;
}

/** Owns task retrieval, filtering, pagination, and mutation state. */
export function useTasksPanel({ cases, selectedCase }: UseTasksPanelInput) {
  const [tasks, setTasks] = useState<CaseTaskRecord[]>([]);
  const [caseFilter, setCaseFilter] = useState(selectedCase?.id ?? "ALL");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>("ALL");
  const [sort, setSort] = useState<TaskSort>("DUE_ASC");
  const [editorState, setEditorState] = useState<TaskEditorState>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<TaskNotice | null>(null);
  const [page, setPage] = useState(1);

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

  const editableCases = cases.filter((caseRecord) => caseRecord.access?.canEdit !== false);
  const activeTask =
    editorState?.mode === "edit"
      ? tasks.find((task) => task.id === editorState.taskId) ?? null
      : null;
  const heroCase =
    caseFilter === "ALL"
      ? selectedCase
      : cases.find((caseRecord) => caseRecord.id === caseFilter) ?? selectedCase;
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

  /** Determines task editability from its current case access record. */
  function canEditTask(task: CaseTaskRecord) {
    const taskCase = cases.find((caseRecord) => caseRecord.id === task.caseId);
    return Boolean(taskCase && (taskCase.access?.canEdit ?? true));
  }

  /** Creates or updates a task from the shared editor contract. */
  async function saveTask(input: TaskEditorSubmission) {
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

  /** Deletes one task and closes its editor. */
  async function deleteTask(taskId: string) {
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

  /** Toggles a task between complete and unopened states. */
  async function toggleTaskComplete(task: CaseTaskRecord) {
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

  return {
    activeTask,
    canEditTask,
    caseFilter,
    completedCount,
    completion,
    deleteTask,
    editableCases,
    editorState,
    filteredTaskCount: filteredTasks.length,
    heroCase,
    inProgressCount,
    isLoading,
    notice,
    overdueCount,
    pageCount,
    priorityFilter,
    reviewCount,
    safePage,
    saveTask,
    scopedTasks,
    setCaseFilter,
    setEditorState,
    setPage,
    setPriorityFilter,
    setSort,
    setStatusFilter,
    sort,
    statusFilter,
    todoCount,
    toggleTaskComplete,
    updatingTaskId,
    visibleTasks
  };
}
