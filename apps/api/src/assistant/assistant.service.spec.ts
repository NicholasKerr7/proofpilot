import { NotFoundException } from "@nestjs/common";
import {
  AssistantMessageRole,
  AssistantResponseMode,
  CaseStatus,
  ChecklistStatus,
  DocumentStatus
} from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { AssistantService } from "./assistant.service.js";

const userId = "user-1";
const caseId = "case-1";
const createdAt = new Date("2026-07-14T12:00:00.000Z");

function createCaseRecord() {
  return {
    id: caseId,
    title: "PayPal account closure appeal",
    platform: "PayPal",
    status: CaseStatus.NEEDS_MORE_EVIDENCE,
    summary: "PayPal limited the account after a payment review.",
    deadline: new Date("2026-07-28T12:00:00.000Z"),
    createdAt,
    documents: [
      {
        id: "document-1",
        originalName: "restriction-notice.pdf",
        status: DocumentStatus.PROCESSED
      }
    ],
    events: [
      {
        id: "event-1",
        occurredAt: new Date("2026-07-01T12:00:00.000Z"),
        title: "Restriction notice received",
        description: "PayPal limited the account."
      }
    ],
    checklist: [
      {
        id: "checklist-1",
        label: "Account restriction notice",
        description: "Upload the platform notice.",
        status: ChecklistStatus.FOUND
      },
      {
        id: "checklist-2",
        label: "Account ownership proof",
        description: "Upload proof tied to the account.",
        status: ChecklistStatus.MISSING
      }
    ],
    statements: [
      {
        id: "statement-1",
        content: "I am requesting a review.",
        updatedAt: createdAt
      }
    ],
    _count: {
      documents: 1,
      events: 1,
      checklist: 2,
      statements: 1
    }
  };
}

function createPrismaMock() {
  const transactionClient = {
    assistantThread: {
      upsert: vi.fn()
    },
    assistantMessage: {
      create: vi.fn()
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  return {
    case: {
      findFirst: vi.fn()
    },
    assistantThread: {
      findUnique: vi.fn()
    },
    transactionClient,
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    )
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe("AssistantService", () => {
  let prisma: PrismaMock;
  let service: AssistantService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AssistantService(prisma as unknown as PrismaService);
  });

  it("returns an owner-scoped guided workspace with persisted messages", async () => {
    prisma.case.findFirst.mockResolvedValue(createCaseRecord());
    prisma.assistantThread.findUnique.mockResolvedValue({
      id: "thread-1",
      messages: [
        {
          id: "message-2",
          role: AssistantMessageRole.ASSISTANT,
          content: "Review the missing ownership proof.",
          responseMode: AssistantResponseMode.GUIDED,
          model: null,
          createdAt: new Date("2026-07-14T12:01:00.000Z")
        },
        {
          id: "message-1",
          role: AssistantMessageRole.USER,
          content: "What evidence is missing?",
          responseMode: null,
          model: null,
          createdAt
        }
      ]
    });

    const result = await service.getWorkspace(userId, caseId);

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        id: caseId,
        OR: expect.any(Array)
      },
      select: expect.any(Object)
    });
    expect(prisma.assistantThread.findUnique).toHaveBeenCalledWith({
      where: {
        userId_caseId: { userId, caseId }
      },
      select: {
        id: true,
        messages: expect.objectContaining({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50
        })
      }
    });
    expect(result).toMatchObject({
      capability: {
        model: null,
        modelGeneration: false,
        responseMode: "GUIDED"
      },
      case: {
        id: caseId,
        progress: 41,
        checklistReady: 1,
        checklistTotal: 2
      },
      threadId: "thread-1",
      messages: [
        {
          id: "message-1",
          role: "USER",
          responseMode: null
        },
        {
          id: "message-2",
          role: "ASSISTANT",
          responseMode: "GUIDED"
        }
      ]
    });
  });

  it("persists both sides of a guided exchange without auditing prompt content", async () => {
    prisma.case.findFirst.mockResolvedValue(createCaseRecord());
    prisma.transactionClient.assistantThread.upsert.mockResolvedValue({ id: "thread-1" });
    prisma.transactionClient.assistantMessage.create
      .mockResolvedValueOnce({
        id: "message-user",
        role: AssistantMessageRole.USER,
        content: "What evidence am I missing?",
        responseMode: null,
        model: null,
        createdAt
      })
      .mockResolvedValueOnce({
        id: "message-assistant",
        role: AssistantMessageRole.ASSISTANT,
        content: "Your PayPal case has 1 checklist item that is not ready.",
        responseMode: AssistantResponseMode.GUIDED,
        model: null,
        createdAt
      });

    const result = await service.createMessage(userId, caseId, {
      content: "  What evidence am I missing?  "
    });

    expect(prisma.transactionClient.assistantThread.upsert).toHaveBeenCalledWith({
      where: {
        userId_caseId: { userId, caseId }
      },
      update: { title: "PayPal account closure appeal" },
      create: {
        userId,
        caseId,
        title: "PayPal account closure appeal"
      },
      select: { id: true }
    });
    expect(prisma.transactionClient.assistantMessage.create).toHaveBeenNthCalledWith(1, {
      data: {
        threadId: "thread-1",
        role: AssistantMessageRole.USER,
        content: "What evidence am I missing?"
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.assistantMessage.create).toHaveBeenNthCalledWith(2, {
      data: {
        threadId: "thread-1",
        role: AssistantMessageRole.ASSISTANT,
        content: expect.stringContaining("Account ownership proof"),
        responseMode: AssistantResponseMode.GUIDED
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        caseId,
        action: "assistant.guided_response_created",
        metadata: {
          assistantMessageId: "message-assistant",
          intent: "EVIDENCE",
          promptLength: 27,
          responseMode: AssistantResponseMode.GUIDED,
          threadId: "thread-1"
        }
      }
    });
    expect(result.threadId).toBe("thread-1");
    expect(result.assistantMessage.responseMode).toBe("GUIDED");
  });

  it("rejects access before reading or creating a thread for another user's case", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.getWorkspace(userId, caseId)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(
      service.createMessage(userId, caseId, { content: "Summarize my case" })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assistantThread.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
