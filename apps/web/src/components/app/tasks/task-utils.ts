import type {
  CaseTaskPriority,
  CaseTaskRecord,
  CaseTaskStatus
} from "@proofpilot/types";

export type TaskStatusFilter = "ALL" | CaseTaskStatus;
export type TaskPriorityFilter = "ALL" | CaseTaskPriority;
export type TaskSort = "DUE_ASC" | "DUE_DESC" | "PRIORITY" | "UPDATED";

export const taskStatusOptions: Array<{
  label: string;
  value: CaseTaskStatus;
}> = [
  { label: "To do", value: "TODO" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Review", value: "REVIEW" },
  { label: "Completed", value: "COMPLETED" }
];

export const taskPriorityOptions: Array<{
  label: string;
  value: CaseTaskPriority;
}> = [
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" }
];

const priorityWeight: Record<CaseTaskPriority, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export function getTaskStatusLabel(status: CaseTaskStatus) {
  return taskStatusOptions.find((option) => option.value === status)?.label ?? status;
}

export function getTaskPriorityLabel(priority: CaseTaskPriority) {
  return taskPriorityOptions.find((option) => option.value === priority)?.label ?? priority;
}

export function getTaskStatusVariant(status: CaseTaskStatus) {
  if (status === "COMPLETED") {
    return "success" as const;
  }

  if (status === "IN_PROGRESS") {
    return "warning" as const;
  }

  if (status === "REVIEW") {
    return "default" as const;
  }

  return "secondary" as const;
}

export function getTaskPriorityVariant(priority: CaseTaskPriority) {
  if (priority === "HIGH") {
    return "danger" as const;
  }

  if (priority === "MEDIUM") {
    return "warning" as const;
  }

  return "success" as const;
}

export function isTaskOverdue(task: CaseTaskRecord, now = Date.now()) {
  return Boolean(
    task.dueAt && task.status !== "COMPLETED" && new Date(task.dueAt).getTime() < now
  );
}

export function formatTaskDueDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function sortTasks(tasks: CaseTaskRecord[], sort: TaskSort) {
  return [...tasks].sort((left, right) => {
    if (sort === "PRIORITY") {
      return (
        priorityWeight[right.priority] - priorityWeight[left.priority] ||
        compareDueDates(left, right)
      );
    }

    if (sort === "UPDATED") {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }

    if (sort === "DUE_DESC") {
      return compareDueDates(left, right, -1);
    }

    return compareDueDates(left, right);
  });
}

function compareDueDates(
  left: CaseTaskRecord,
  right: CaseTaskRecord,
  direction: 1 | -1 = 1
) {
  if (!left.dueAt && !right.dueAt) {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }

  if (!left.dueAt) {
    return 1;
  }

  if (!right.dueAt) {
    return -1;
  }

  return direction * (new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());
}
