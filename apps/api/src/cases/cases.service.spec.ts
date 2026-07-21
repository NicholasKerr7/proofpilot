import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CaseStatus, ChecklistStatus, PacketStatus } from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { PacketGenerationQueueService } from "../queue/packet-generation-queue.service.js";
import { CasesService } from "./cases.service.js";

const databaseMocks = vi.hoisted(() => ({
  analyzeCaseChecklist: vi.fn(),
  analyzeCaseChecklistTransaction: vi.fn()
}));
const storageMocks = vi.hoisted(() => ({
  createPresignedDownloadUrl: vi.fn()
}));

vi.mock("@proofpilot/database", async () => {
  const actual = await vi.importActual<typeof import("@proofpilot/database")>(
    "@proofpilot/database"
  );

  return {
    ...actual,
    analyzeCaseChecklist: databaseMocks.analyzeCaseChecklist,
    analyzeCaseChecklistTransaction: databaseMocks.analyzeCaseChecklistTransaction
  };
});

vi.mock("@proofpilot/storage", () => ({
  createPresignedDownloadUrl: storageMocks.createPresignedDownloadUrl
}));

type PrismaMock = ReturnType<typeof createPrismaMock>;
type QueueMock = ReturnType<typeof createPacketQueueMock>;

const ownerId = "user-1";
const caseId = "case-1";
const packetCreatedAt = new Date("2026-01-01T12:00:00.000Z");
const packetUpdatedAt = new Date("2026-01-01T12:01:00.000Z");

function createPacketRecord(overrides: Partial<ReturnType<typeof basePacketRecord>> = {}) {
  return {
    ...basePacketRecord(),
    ...overrides
  };
}

function basePacketRecord() {
  return {
    id: "packet-1",
    caseId,
    status: PacketStatus.GENERATING as PacketStatus,
    createdAt: packetCreatedAt,
    updatedAt: packetUpdatedAt,
    exports: [] as Array<{
      id: string;
      storageKey: string;
      byteSize: number | null;
      pageCount: number | null;
      includedDocumentCount: number;
      indexedDocumentCount: number;
      createdAt: Date;
    }>
  };
}

function createPrismaMock() {
  const prisma = {
    $transaction: vi.fn(),
    auditLog: {
      count: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn()
    },
    case: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    casePacket: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    caseChecklistItem: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    caseEvent: {
      aggregate: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    document: {
      findMany: vi.fn()
    },
    notification: {
      create: vi.fn().mockResolvedValue({})
    },
    caseStatement: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    caseSummary: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    statementGuidance: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    statementVersion: {
      aggregate: vi.fn(),
      findFirst: vi.fn()
    },
    eventSource: {
      createMany: vi.fn(),
      deleteMany: vi.fn()
    }
  };

  prisma.$transaction.mockImplementation(async (transaction: unknown) => {
    if (typeof transaction === "function") {
      return (transaction as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }

    return Promise.all(transaction as Promise<unknown>[]);
  });

  return prisma;
}

function createPacketQueueMock() {
  return {
    addGeneratePacketJob: vi.fn()
  };
}

function createService(prisma: PrismaMock, queue: QueueMock) {
  return new CasesService(
    prisma as unknown as PrismaService,
    queue as unknown as PacketGenerationQueueService
  );
}

describe("CasesService", () => {
  let prisma: PrismaMock;
  let queue: QueueMock;
  let service: CasesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    queue = createPacketQueueMock();
    service = createService(prisma, queue);
    databaseMocks.analyzeCaseChecklist.mockResolvedValue({
      documentsAnalyzed: 0,
      foundCount: 1,
      matchCount: 0,
      missingCount: 0,
      status: "READY_FOR_REVIEW"
    });
    databaseMocks.analyzeCaseChecklistTransaction.mockResolvedValue({
      documentsAnalyzed: 0,
      foundCount: 1,
      matchCount: 0,
      missingCount: 0,
      status: "READY_FOR_REVIEW"
    });
  });

  it("notifies the owner when an enabled case status changes", async () => {
    prisma.case.findFirst.mockResolvedValue({
      id: caseId,
      status: CaseStatus.DRAFT,
      owner: {
        preference: {
          inAppNotifications: true,
          notifyCaseUpdates: true
        }
      }
    });
    prisma.case.update.mockResolvedValue({
      id: caseId,
      title: "PayPal appeal",
      status: CaseStatus.COLLECTING_EVIDENCE,
      caseType: { id: "case-type-1" }
    });

    const result = await service.update(ownerId, caseId, {
      status: CaseStatus.COLLECTING_EVIDENCE
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        type: "case_status_updated",
        title: "Case status updated",
        body: "PayPal appeal is now collecting evidence."
      }
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: caseId,
        status: CaseStatus.COLLECTING_EVIDENCE
      })
    );
  });

  it("does not create a case status alert when case notifications are disabled", async () => {
    prisma.case.findFirst.mockResolvedValue({
      id: caseId,
      status: CaseStatus.DRAFT,
      owner: {
        preference: {
          inAppNotifications: true,
          notifyCaseUpdates: false
        }
      }
    });
    prisma.case.update.mockResolvedValue({
      id: caseId,
      title: "PayPal appeal",
      status: CaseStatus.COLLECTING_EVIDENCE,
      caseType: { id: "case-type-1" }
    });

    await service.update(ownerId, caseId, {
      status: CaseStatus.COLLECTING_EVIDENCE
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("manually completes an owned checklist item and refreshes case readiness", async () => {
    const caseRecord = { id: caseId, checklist: [] };
    prisma.caseChecklistItem.findFirst.mockResolvedValue({
      id: "item-1",
      label: "Support conversation",
      requirement: { required: true }
    });
    prisma.case.findFirst.mockResolvedValue(caseRecord);

    const result = await service.updateChecklistItem(ownerId, caseId, "item-1", {
      completed: true
    });

    expect(prisma.caseChecklistItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: "item-1",
        caseId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: {
        id: true,
        label: true,
        requirement: {
          select: { required: true }
        }
      }
    });
    expect(prisma.caseChecklistItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: {
        manuallyCompletedAt: expect.any(Date),
        status: "COMPLETE"
      }
    });
    expect(databaseMocks.analyzeCaseChecklistTransaction).toHaveBeenCalledWith(prisma, {
      auditAction: null,
      caseId,
      ownerId
    });
    expect(result).toEqual(caseRecord);
  });

  it("reopens an optional checklist item without making it required", async () => {
    prisma.caseChecklistItem.findFirst.mockResolvedValue({
      id: "item-1",
      label: "Additional context",
      requirement: { required: false }
    });
    prisma.case.findFirst.mockResolvedValue({ id: caseId, checklist: [] });

    await service.updateChecklistItem(ownerId, caseId, "item-1", {
      completed: false
    });

    expect(prisma.caseChecklistItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: {
        manuallyCompletedAt: null,
        status: "OPTIONAL"
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.checklist_item_reopened",
        metadata: {
          checklistItemId: "item-1",
          label: "Additional context"
        }
      }
    });
  });

  it("rejects checklist updates for items outside the owned case", async () => {
    prisma.caseChecklistItem.findFirst.mockResolvedValue(null);

    await expect(
      service.updateChecklistItem(ownerId, caseId, "foreign-item", {
        completed: true
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.caseChecklistItem.update).not.toHaveBeenCalled();
    expect(databaseMocks.analyzeCaseChecklistTransaction).not.toHaveBeenCalled();
  });

  it("saves normalized guided answers for an owned case without auditing their contents", async () => {
    const createdAt = new Date("2026-05-12T12:00:00.000Z");
    const savedGuidance = {
      id: "guidance-1",
      caseId,
      platformAction: "PayPal limited my account",
      actionDate: null,
      reasonGiven: null,
      accountUse: "Routine business payments",
      supportContact: null,
      requestedOutcome: "Restore access",
      supportingDocuments: null,
      createdAt,
      updatedAt: createdAt
    };
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.statementGuidance.upsert.mockResolvedValue(savedGuidance);

    const result = await service.saveStatementGuidance(ownerId, caseId, {
      platformAction: " PayPal limited my account ",
      actionDate: "",
      reasonGiven: " ",
      accountUse: " Routine business payments ",
      supportContact: "",
      requestedOutcome: " Restore access ",
      supportingDocuments: ""
    });

    expect(prisma.statementGuidance.upsert).toHaveBeenCalledWith({
      where: { caseId },
      update: {
        platformAction: "PayPal limited my account",
        actionDate: null,
        reasonGiven: null,
        accountUse: "Routine business payments",
        supportContact: null,
        requestedOutcome: "Restore access",
        supportingDocuments: null
      },
      create: {
        caseId,
        platformAction: "PayPal limited my account",
        actionDate: null,
        reasonGiven: null,
        accountUse: "Routine business payments",
        supportContact: null,
        requestedOutcome: "Restore access",
        supportingDocuments: null
      },
      select: expect.any(Object)
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.statement_guidance_saved",
        metadata: {
          answeredCount: 3,
          guidanceId: "guidance-1"
        }
      }
    });
    expect(result).toEqual({
      ...savedGuidance,
      actionDate: "",
      reasonGiven: "",
      supportContact: "",
      supportingDocuments: ""
    });
  });

  it("restores an owned statement version as a new version", async () => {
    const createdAt = new Date("2026-05-12T12:00:00.000Z");
    const restoredStatement = {
      id: "statement-1",
      caseId,
      content: "Earlier statement content",
      createdAt,
      updatedAt: createdAt,
      versions: [
        {
          id: "version-3",
          content: "Earlier statement content",
          version: 3,
          createdAt
        }
      ]
    };
    prisma.statementVersion.findFirst.mockResolvedValue({
      content: "Earlier statement content",
      version: 1
    });
    prisma.caseStatement.findFirst.mockResolvedValue({ id: "statement-1" });
    prisma.statementVersion.aggregate.mockResolvedValue({ _max: { version: 2 } });
    prisma.caseStatement.update.mockResolvedValue(restoredStatement);

    const result = await service.restoreStatementVersion(ownerId, caseId, "version-1");

    expect(prisma.statementVersion.findFirst).toHaveBeenCalledWith({
      where: {
        id: "version-1",
        statement: {
          caseId,
          case: {
            ownerId,
            archivedAt: null
          }
        }
      },
      select: {
        content: true,
        version: true
      }
    });
    expect(prisma.caseStatement.update).toHaveBeenCalledWith({
      where: { id: "statement-1" },
      data: {
        content: "Earlier statement content",
        versions: {
          create: {
            content: "Earlier statement content",
            version: 3
          }
        }
      },
      select: expect.any(Object)
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.statement_restored",
        metadata: {
          statementId: "statement-1",
          version: 3,
          restoredFromVersion: 1
        }
      }
    });
    expect(result).toEqual(restoredStatement);
  });

  it("rejects statement versions outside the owned case", async () => {
    prisma.statementVersion.findFirst.mockResolvedValue(null);

    await expect(
      service.restoreStatementVersion(ownerId, caseId, "foreign-version")
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.caseStatement.update).not.toHaveBeenCalled();
  });

  it("generates and versions a case summary from owned timeline and evidence records", async () => {
    const createdAt = new Date("2026-05-15T12:00:00.000Z");
    const summaryRecord = {
      id: "summary-1",
      caseId,
      content: "Generated case summary",
      createdAt,
      updatedAt: createdAt
    };
    prisma.case.findFirst.mockResolvedValue({
      id: caseId,
      title: "PayPal account closure appeal",
      platform: "PayPal",
      documents: [{ originalName: "notice.pdf", status: "PROCESSED" }],
      events: [
        {
          occurredAt: new Date("2026-05-12T12:00:00.000Z"),
          title: "Notice received"
        }
      ],
      checklist: [
        {
          label: "Account notice",
          status: ChecklistStatus.FOUND,
          requirement: { required: true }
        }
      ],
      statements: [{ content: "Saved statement" }],
      statementGuidance: { requestedOutcome: "Restore access" }
    });
    prisma.caseSummary.create.mockResolvedValue(summaryRecord);

    const result = await service.generateSummary(ownerId, caseId);

    expect(prisma.caseSummary.create).toHaveBeenCalledWith({
      data: {
        caseId,
        content: expect.stringContaining("Notice received")
      },
      select: expect.any(Object)
    });
    expect(prisma.case.update).toHaveBeenCalledWith({
      where: { id: caseId },
      data: { summary: expect.stringContaining("Restore access") }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.statement_summary_generated",
        metadata: {
          documentCount: 1,
          eventCount: 1,
          summaryId: "summary-1"
        }
      }
    });
    expect(result).toEqual(summaryRecord);
  });

  it("creates a generating packet and enqueues packet generation", async () => {
    const packet = createPacketRecord();
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.casePacket.findFirst.mockResolvedValue(null);
    prisma.casePacket.create.mockResolvedValue(packet);
    queue.addGeneratePacketJob.mockResolvedValue({ id: "job-1", name: "generate_case_packet" });

    const result = await service.generatePacket(ownerId, caseId);

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        id: caseId,
        ownerId
      },
      select: { id: true }
    });
    expect(prisma.casePacket.create).toHaveBeenCalledWith({
      data: {
        caseId,
        status: PacketStatus.GENERATING
      },
      select: expect.any(Object)
    });
    expect(queue.addGeneratePacketJob).toHaveBeenCalledWith({
      caseId,
      ownerId,
      packetId: packet.id
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.packet_generation_queued",
        metadata: {
          jobId: "job-1",
          packetId: packet.id
        }
      }
    });
    expect(result).toEqual({
      id: packet.id,
      caseId,
      status: PacketStatus.GENERATING,
      createdAt: packetCreatedAt,
      updatedAt: packetUpdatedAt,
      exports: []
    });
  });

  it("lists owned packet exports with separate preview and download URLs", async () => {
    const packetExportCreatedAt = new Date("2026-01-01T12:02:00.000Z");
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.casePacket.findMany.mockResolvedValue([
      createPacketRecord({
        status: PacketStatus.READY,
        exports: [
          {
            id: "export-1",
            storageKey: "users/user-1/cases/case-1/packets/export.pdf",
            byteSize: 8_192,
            pageCount: 7,
            includedDocumentCount: 2,
            indexedDocumentCount: 3,
            createdAt: packetExportCreatedAt
          }
        ]
      })
    ]);
    storageMocks.createPresignedDownloadUrl.mockImplementation(
      async (input: { disposition: "attachment" | "inline" }) =>
        `https://storage.test/packet.pdf?disposition=${input.disposition}`
    );

    const result = await service.listPackets(ownerId, caseId);

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: { id: true }
    });
    expect(prisma.casePacket.findMany).toHaveBeenCalledWith({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: expect.any(Object)
    });
    expect(storageMocks.createPresignedDownloadUrl).toHaveBeenCalledTimes(2);
    expect(storageMocks.createPresignedDownloadUrl).toHaveBeenCalledWith({
      disposition: "attachment",
      expiresInSeconds: 900,
      fileName: "proofpilot-case-packet.pdf",
      key: "users/user-1/cases/case-1/packets/export.pdf"
    });
    expect(storageMocks.createPresignedDownloadUrl).toHaveBeenCalledWith({
      disposition: "inline",
      expiresInSeconds: 900,
      fileName: "proofpilot-case-packet.pdf",
      key: "users/user-1/cases/case-1/packets/export.pdf"
    });
    expect(result[0]?.exports[0]).toEqual({
      id: "export-1",
      byteSize: 8_192,
      pageCount: 7,
      includedDocumentCount: 2,
      indexedDocumentCount: 3,
      createdAt: packetExportCreatedAt,
      downloadUrl: "https://storage.test/packet.pdf?disposition=attachment",
      previewUrl: "https://storage.test/packet.pdf?disposition=inline"
    });
  });

  it("returns an existing generating packet without enqueueing a duplicate job", async () => {
    const existingPacket = createPacketRecord({ id: "packet-existing" });
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.casePacket.findFirst.mockResolvedValue(existingPacket);

    const result = await service.generatePacket(ownerId, caseId);

    expect(prisma.casePacket.create).not.toHaveBeenCalled();
    expect(queue.addGeneratePacketJob).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(result.id).toBe(existingPacket.id);
    expect(result.status).toBe(PacketStatus.GENERATING);
  });

  it("rejects packet generation when the case is not owned by the user", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.generatePacket(ownerId, caseId)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.casePacket.findFirst).not.toHaveBeenCalled();
    expect(queue.addGeneratePacketJob).not.toHaveBeenCalled();
  });

  it("marks the packet failed when enqueueing the job fails", async () => {
    const packet = createPacketRecord();
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.casePacket.findFirst.mockResolvedValue(null);
    prisma.casePacket.create.mockResolvedValue(packet);
    queue.addGeneratePacketJob.mockRejectedValue(new Error("Redis is unavailable"));

    await expect(service.generatePacket(ownerId, caseId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );

    expect(prisma.casePacket.update).toHaveBeenCalledWith({
      where: { id: packet.id },
      data: { status: PacketStatus.FAILED }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.packet_generation_queue_failed",
        metadata: {
          message: "Redis is unavailable",
          packetId: packet.id
        }
      }
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns paginated, sanitized case activity for the owner", async () => {
    const firstCreatedAt = new Date("2026-05-13T14:30:00.000Z");
    const secondCreatedAt = new Date("2026-05-13T14:20:00.000Z");
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "activity-1",
        action: "document.upload_completed",
        metadata: {
          documentId: "document-1",
          originalName: "account-notice.pdf",
          jobId: "private-job-id"
        },
        createdAt: firstCreatedAt
      },
      {
        id: "activity-2",
        action: "document.processing_failed",
        metadata: {
          documentId: "document-2",
          originalName: "support-thread.png",
          message: "Internal provider details"
        },
        createdAt: secondCreatedAt
      }
    ]);
    prisma.auditLog.count.mockResolvedValue(3);

    const result = await service.listActivity(ownerId, caseId, {
      category: "evidence",
      limit: 2,
      offset: 0
    });

    const where = {
      caseId,
      action: { startsWith: "document." }
    };
    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        id: caseId,
        ownerId
      },
      select: { id: true }
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 0,
      take: 2,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true
      }
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({
      items: [
        {
          id: "activity-1",
          action: "document.upload_completed",
          category: "evidence",
          title: "Document uploaded",
          detail: "account-notice.pdf",
          createdAt: firstCreatedAt.toISOString()
        },
        {
          id: "activity-2",
          action: "document.processing_failed",
          category: "evidence",
          title: "Document processing failed",
          detail: "support-thread.png",
          createdAt: secondCreatedAt.toISOString()
        }
      ],
      total: 3,
      hasMore: true
    });
  });

  it("rejects activity access when the case is not owned by the user", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(
      service.listActivity(ownerId, caseId, {
        category: "all",
        limit: 20,
        offset: 0
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.count).not.toHaveBeenCalled();
  });

  it("creates an evidence-linked timeline event in chronological order", async () => {
    const occurredAt = new Date("2026-05-12T12:00:00.000Z");
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.document.findMany.mockResolvedValue([{ id: "document-1" }]);
    prisma.caseEvent.findFirst.mockResolvedValue({ sortOrder: 1 });
    prisma.caseEvent.updateMany.mockResolvedValue({ count: 2 });
    prisma.caseEvent.create.mockResolvedValue({
      id: "event-1",
      sortOrder: 1,
      occurredAt,
      title: "Appeal submitted",
      description: "Submitted through the support portal.",
      confidence: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      sources: [
        {
          id: "source-1",
          document: {
            id: "document-1",
            originalName: "appeal-confirmation.pdf"
          }
        }
      ]
    });

    const result = await service.createTimelineEvent(ownerId, caseId, {
      occurredAt: occurredAt.toISOString(),
      title: " Appeal submitted ",
      description: " Submitted through the support portal. ",
      documentIds: ["document-1"]
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["document-1"] },
        caseId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: { id: true }
    });
    expect(prisma.caseEvent.updateMany).toHaveBeenCalledWith({
      where: {
        caseId,
        sortOrder: { gte: 1 }
      },
      data: {
        sortOrder: { increment: 1 }
      }
    });
    expect(prisma.caseEvent.create).toHaveBeenCalledWith({
      data: {
        caseId,
        sortOrder: 1,
        occurredAt,
        title: "Appeal submitted",
        description: "Submitted through the support portal.",
        confidence: null,
        sources: {
          create: [{ documentId: "document-1" }]
        }
      },
      select: expect.any(Object)
    });
    expect(result.id).toBe("event-1");
  });

  it("rejects timeline sources that do not belong to the owned case", async () => {
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.document.findMany.mockResolvedValue([]);

    await expect(
      service.createTimelineEvent(ownerId, caseId, {
        occurredAt: "2026-05-12T12:00:00.000Z",
        title: "Appeal submitted",
        documentIds: ["document-from-another-case"]
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.caseEvent.create).not.toHaveBeenCalled();
  });

  it("rejects updates to timeline events outside the owned case", async () => {
    prisma.caseEvent.findFirst.mockResolvedValue(null);

    await expect(
      service.updateTimelineEvent(ownerId, caseId, "foreign-event", {
        title: "Changed title"
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.caseEvent.update).not.toHaveBeenCalled();
    expect(prisma.eventSource.deleteMany).not.toHaveBeenCalled();
  });

  it("updates an owned timeline event and replaces its evidence links", async () => {
    const occurredAt = new Date("2026-05-12T12:00:00.000Z");
    const updatedEvent = {
      id: "event-1",
      sortOrder: 0,
      occurredAt,
      title: "Appeal submitted",
      description: null,
      confidence: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      sources: [
        {
          id: "source-2",
          document: {
            id: "document-2",
            originalName: "appeal-email.eml"
          }
        }
      ]
    };
    prisma.caseEvent.findFirst.mockResolvedValue({ id: "event-1", title: "Old title" });
    prisma.document.findMany.mockResolvedValue([{ id: "document-2" }]);
    prisma.caseEvent.update.mockResolvedValue({});
    prisma.eventSource.deleteMany.mockResolvedValue({ count: 1 });
    prisma.eventSource.createMany.mockResolvedValue({ count: 1 });
    prisma.caseEvent.findUniqueOrThrow.mockResolvedValue(updatedEvent);

    const result = await service.updateTimelineEvent(ownerId, caseId, "event-1", {
      title: " Appeal submitted ",
      description: null,
      documentIds: ["document-2"]
    });

    expect(prisma.caseEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: {
        title: "Appeal submitted",
        description: null
      }
    });
    expect(prisma.eventSource.deleteMany).toHaveBeenCalledWith({
      where: { eventId: "event-1" }
    });
    expect(prisma.eventSource.createMany).toHaveBeenCalledWith({
      data: [{ eventId: "event-1", documentId: "document-2" }]
    });
    expect(result).toEqual(updatedEvent);
  });

  it("requires timeline reordering to include exactly the owned case events", async () => {
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.caseEvent.findMany.mockResolvedValue([{ id: "event-1" }, { id: "event-2" }]);

    await expect(
      service.reorderTimeline(ownerId, caseId, {
        eventIds: ["event-1", "foreign-event"]
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.caseEvent.update).not.toHaveBeenCalled();
  });

  it("removes stale analyzed events when timeline analysis has no current documents", async () => {
    prisma.case.findFirst
      .mockResolvedValueOnce({ id: caseId, documents: [] })
      .mockResolvedValueOnce({ id: caseId });
    prisma.caseEvent.deleteMany.mockResolvedValue({ count: 2 });
    prisma.caseEvent.findMany.mockResolvedValue([]);

    await service.analyzeTimeline(ownerId, caseId);

    expect(prisma.caseEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        caseId,
        confidence: { not: null }
      }
    });
    expect(prisma.caseEvent.create).not.toHaveBeenCalled();
  });

  it("rejects deletion of timeline events outside the owned case", async () => {
    prisma.caseEvent.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteTimelineEvent(ownerId, caseId, "foreign-event")
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.caseEvent.delete).not.toHaveBeenCalled();
  });
});
