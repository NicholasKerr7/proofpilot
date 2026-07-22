export const caseTaskPriorities = ["LOW", "MEDIUM", "HIGH"] as const;
export type CaseTaskPriority = (typeof caseTaskPriorities)[number];

export const caseTaskStatuses = ["TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const;
export type CaseTaskStatus = (typeof caseTaskStatuses)[number];

export interface CaseTaskCaseSummary {
  deadline: string | null;
  id: string;
  platform: string;
  title: string;
}

export interface CaseTaskRecord {
  case: CaseTaskCaseSummary;
  caseId: string;
  completedAt: string | null;
  createdAt: string;
  description: string | null;
  dueAt: string | null;
  id: string;
  priority: CaseTaskPriority;
  progress: number;
  status: CaseTaskStatus;
  title: string;
  updatedAt: string;
}

export interface CreateCaseTaskInput {
  description?: string;
  dueAt?: string;
  priority?: CaseTaskPriority;
  progress?: number;
  status?: CaseTaskStatus;
  title: string;
}

export interface UpdateCaseTaskInput {
  description?: string | null;
  dueAt?: string | null;
  priority?: CaseTaskPriority;
  progress?: number;
  status?: CaseTaskStatus;
  title?: string;
}
