import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { TasksService } from "./tasks.service.js";

const userId = "user-1";
const caseId = "case-1";
const taskId = "task-1";

function createPrismaMock() {
  const transactionClient = {
    caseTask: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    }
  };
  const prisma = {
    case: {
      findFirst: vi.fn()
    },
    caseTask: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([])
    },
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    transactionClient
  };

  return prisma;
}

function createTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: taskId,
    caseId,
    title: "Upload proof of identity",
    description: "Provide a valid government-issued ID.",
    status: "TODO",
    priority: "HIGH",
    dueAt: new Date("2026-08-01T12:00:00.000Z"),
    progress: 0,
    completedAt: null,
    createdAt: new Date("2026-07-22T12:00:00.000Z"),
    updatedAt: new Date("2026-07-22T12:00:00.000Z"),
    case: {
      id: caseId,
      deadline: new Date("2026-08-10T12:00:00.000Z"),
      platform: "PayPal",
      title: "PayPal appeal"
    },
    ...overrides
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe("TasksService", () => {
  let prisma: PrismaMock;
  let service: TasksService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new TasksService(prisma as unknown as PrismaService);
  });

  it("lists tasks only through active cases the user can read", async () => {
    await expect(service.list(userId)).resolves.toEqual([]);

    expect(prisma.caseTask.findMany).toHaveBeenCalledWith({
      where: {
        case: {
          OR: expect.any(Array),
          archivedAt: null
        }
      },
      orderBy: [
        { dueAt: { nulls: "last", sort: "asc" } },
        { createdAt: "desc" }
      ],
      select: expect.any(Object),
      take: 250
    });
  });

  it("creates a normalized task inside an editable case", async () => {
    const createdTask = createTaskRow({ progress: 25, status: "IN_PROGRESS" });
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.transactionClient.caseTask.create.mockResolvedValue(createdTask);

    await expect(
      service.create(userId, caseId, {
        description: "  Provide a valid government-issued ID.  ",
        dueAt: "2026-08-01T12:00:00.000Z",
        priority: "HIGH",
        status: "IN_PROGRESS",
        title: "  Upload proof of identity  "
      })
    ).resolves.toEqual(createdTask);

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        id: caseId,
        OR: expect.any(Array),
        archivedAt: null
      },
      select: { id: true }
    });
    expect(prisma.transactionClient.caseTask.create).toHaveBeenCalledWith({
      data: {
        caseId,
        completedAt: null,
        description: "Provide a valid government-issued ID.",
        dueAt: new Date("2026-08-01T12:00:00.000Z"),
        priority: "HIGH",
        progress: 25,
        status: "IN_PROGRESS",
        title: "Upload proof of identity"
      },
      select: expect.any(Object)
    });
  });

  it("rejects invalid input at the service boundary", async () => {
    prisma.case.findFirst.mockResolvedValue({ id: caseId });

    await expect(
      service.create(userId, caseId, { title: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(userId, caseId, {
        progress: 101,
        title: "Review packet"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("marks an owned task complete and audits only task metadata", async () => {
    const completedTask = createTaskRow({
      completedAt: new Date(),
      progress: 100,
      status: "COMPLETED"
    });
    prisma.caseTask.findFirst.mockResolvedValue({
      id: taskId,
      caseId,
      completedAt: null,
      progress: 40,
      status: "IN_PROGRESS"
    });
    prisma.transactionClient.caseTask.update.mockResolvedValue(completedTask);

    await service.update(userId, taskId, { status: "COMPLETED" });

    expect(prisma.transactionClient.caseTask.update).toHaveBeenCalledWith({
      where: { id: taskId },
      data: {
        completedAt: expect.any(Date),
        progress: 100,
        status: "COMPLETED"
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        caseId,
        action: "case.task_updated",
        metadata: {
          taskId,
          changedFields: ["status"],
          priority: "HIGH",
          progress: 100,
          status: "COMPLETED"
        }
      }
    });
  });

  it("does not expose a task outside the user's editable cases", async () => {
    prisma.caseTask.findFirst.mockResolvedValue(null);

    await expect(
      service.update(userId, taskId, { progress: 50 })
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.delete(userId, taskId)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("deletes an owned task and records an audit event", async () => {
    prisma.caseTask.findFirst.mockResolvedValue({ id: taskId, caseId });

    await expect(service.delete(userId, taskId)).resolves.toEqual({
      deleted: true,
      id: taskId
    });
    expect(prisma.transactionClient.caseTask.delete).toHaveBeenCalledWith({
      where: { id: taskId }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        caseId,
        action: "case.task_deleted",
        metadata: { taskId }
      }
    });
  });
});
