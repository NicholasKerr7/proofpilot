import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  TaskPriority as DatabaseTaskPriority,
  TaskStatus as DatabaseTaskStatus,
  type Prisma
} from "@proofpilot/database";
import {
  caseTaskPriorities,
  caseTaskStatuses,
  type CaseTaskPriority,
  type CaseTaskStatus
} from "@proofpilot/types";
import { buildCaseAccessWhere } from "../common/case-access.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateCaseTaskDto } from "./dto/create-case-task.dto.js";
import type { UpdateCaseTaskDto } from "./dto/update-case-task.dto.js";

const taskSelect = {
  id: true,
  caseId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  progress: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  case: {
    select: {
      id: true,
      title: true,
      platform: true,
      deadline: true
    }
  }
} satisfies Prisma.CaseTaskSelect;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.caseTask.findMany({
      where: {
        case: {
          ...buildCaseAccessWhere(userId, "READ"),
          archivedAt: null
        }
      },
      orderBy: [
        { dueAt: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" }
      ],
      select: taskSelect,
      take: 250
    });
  }

  async create(userId: string, caseId: string, input: CreateCaseTaskDto) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "EDIT"),
        archivedAt: null
      },
      select: { id: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const title = requireTaskText(input.title, "Task title", 160);
    const description = normalizeOptionalTaskText(input.description, "Task description", 1000);
    const priority = parsePriority(input.priority ?? "MEDIUM");
    const status = parseStatus(input.status ?? "TODO");
    const state = normalizeTaskState({
      currentCompletedAt: null,
      currentProgress: getDefaultProgress(status),
      currentStatus: status,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(input.status !== undefined ? { status: input.status } : {})
    });
    const dueAt = input.dueAt ? parseTaskDate(input.dueAt) : null;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.caseTask.create({
        data: {
          caseId: foundCase.id,
          title,
          description,
          dueAt,
          priority: priority as DatabaseTaskPriority,
          progress: state.progress,
          status: state.status as DatabaseTaskStatus,
          completedAt: state.completedAt
        },
        select: taskSelect
      });

      await tx.auditLog.create({
        data: {
          userId,
          caseId: foundCase.id,
          action: "case.task_created",
          metadata: {
            taskId: task.id,
            priority: task.priority,
            status: task.status,
            ...(task.dueAt ? { dueAt: task.dueAt.toISOString() } : {})
          }
        }
      });

      return task;
    });
  }

  async update(userId: string, taskId: string, input: UpdateCaseTaskDto) {
    if (!hasTaskUpdate(input)) {
      throw new BadRequestException("Provide a task change.");
    }

    const task = await this.prisma.caseTask.findFirst({
      where: {
        id: taskId,
        case: {
          ...buildCaseAccessWhere(userId, "EDIT"),
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true,
        completedAt: true,
        progress: true,
        status: true
      }
    });

    if (!task) {
      throw new NotFoundException("Task not found.");
    }

    const title =
      input.title === undefined
        ? undefined
        : requireTaskText(input.title, "Task title", 160);
    const description =
      input.description === undefined
        ? undefined
        : input.description === null
          ? null
          : normalizeOptionalTaskText(input.description, "Task description", 1000);
    const priority = input.priority === undefined ? undefined : parsePriority(input.priority);
    const status = input.status === undefined ? undefined : parseStatus(input.status);
    const dueAt =
      input.dueAt === undefined
        ? undefined
        : input.dueAt === null
          ? null
          : parseTaskDate(input.dueAt);
    const state = normalizeTaskState({
      currentCompletedAt: task.completedAt,
      currentProgress: task.progress,
      currentStatus: task.status as CaseTaskStatus,
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(status !== undefined ? { status } : {})
    });
    const changedFields = getChangedFields(input);

    return this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.caseTask.update({
        where: { id: task.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(dueAt !== undefined ? { dueAt } : {}),
          ...(priority !== undefined
            ? { priority: priority as DatabaseTaskPriority }
            : {}),
          completedAt: state.completedAt,
          progress: state.progress,
          status: state.status as DatabaseTaskStatus
        },
        select: taskSelect
      });

      await tx.auditLog.create({
        data: {
          userId,
          caseId: task.caseId,
          action: "case.task_updated",
          metadata: {
            taskId: task.id,
            changedFields,
            priority: updatedTask.priority,
            progress: updatedTask.progress,
            status: updatedTask.status
          }
        }
      });

      return updatedTask;
    });
  }

  async delete(userId: string, taskId: string) {
    const task = await this.prisma.caseTask.findFirst({
      where: {
        id: taskId,
        case: {
          ...buildCaseAccessWhere(userId, "EDIT"),
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true
      }
    });

    if (!task) {
      throw new NotFoundException("Task not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.caseTask.delete({ where: { id: task.id } });
      await tx.auditLog.create({
        data: {
          userId,
          caseId: task.caseId,
          action: "case.task_deleted",
          metadata: { taskId: task.id }
        }
      });
    });

    return { deleted: true, id: task.id };
  }
}

function requireTaskText(value: string, label: string, maximumLength: number) {
  const normalized = value.trim();

  if (!normalized || normalized.length > maximumLength) {
    throw new BadRequestException(`${label} must be 1 to ${maximumLength} characters.`);
  }

  return normalized;
}

function normalizeOptionalTaskText(
  value: string | undefined,
  label: string,
  maximumLength: number
) {
  if (value === undefined) {
    return null;
  }

  return requireTaskText(value, label, maximumLength);
}

function parseTaskDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("Task due date must be a valid date.");
  }

  return date;
}

function parsePriority(value: string): CaseTaskPriority {
  if (!caseTaskPriorities.includes(value as CaseTaskPriority)) {
    throw new BadRequestException("Task priority is invalid.");
  }

  return value as CaseTaskPriority;
}

function parseStatus(value: string): CaseTaskStatus {
  if (!caseTaskStatuses.includes(value as CaseTaskStatus)) {
    throw new BadRequestException("Task status is invalid.");
  }

  return value as CaseTaskStatus;
}

function normalizeTaskState(input: {
  currentCompletedAt: Date | null;
  currentProgress: number;
  currentStatus: CaseTaskStatus;
  progress?: number;
  status?: CaseTaskStatus;
}) {
  let status = input.status ?? input.currentStatus;
  let progress = input.progress ?? input.currentProgress;

  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw new BadRequestException("Task progress must be a whole number from 0 to 100.");
  }

  if (input.status !== undefined && input.progress === undefined) {
    progress = getDefaultProgress(input.status);
  }

  if (status === "COMPLETED" || progress === 100) {
    status = "COMPLETED";
    progress = 100;

    return {
      completedAt: input.currentCompletedAt ?? new Date(),
      progress,
      status
    };
  }

  return {
    completedAt: null,
    progress,
    status
  };
}

function getDefaultProgress(status: CaseTaskStatus) {
  switch (status) {
    case "COMPLETED":
      return 100;
    case "REVIEW":
      return 90;
    case "IN_PROGRESS":
      return 25;
    default:
      return 0;
  }
}

function hasTaskUpdate(input: UpdateCaseTaskDto) {
  return (
    input.title !== undefined ||
    input.description !== undefined ||
    input.priority !== undefined ||
    input.status !== undefined ||
    input.dueAt !== undefined ||
    input.progress !== undefined
  );
}

function getChangedFields(input: UpdateCaseTaskDto) {
  return ["title", "description", "priority", "status", "dueAt", "progress"].filter(
    (field) => input[field as keyof UpdateCaseTaskDto] !== undefined
  );
}
