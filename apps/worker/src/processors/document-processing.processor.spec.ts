import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessDocumentJobData } from "../queues/document-processing.queue.js";

const mocks = vi.hoisted(() => ({
  analyzeCaseChecklist: vi.fn(),
  prisma: undefined as unknown,
  readStoredObjectBytes: vi.fn()
}));

vi.mock("@proofpilot/database", () => ({
  analyzeCaseChecklist: mocks.analyzeCaseChecklist,
  DocumentStatus: {
    FAILED: "FAILED",
    NEEDS_REVIEW: "NEEDS_REVIEW",
    PROCESSED: "PROCESSED",
    PROCESSING: "PROCESSING"
  },
  getPrismaClient: () => mocks.prisma
}));

vi.mock("@proofpilot/storage", () => ({
  readStoredObjectBytes: mocks.readStoredObjectBytes
}));

function createPrismaMock() {
  const prisma = {
    $transaction: vi.fn(),
    document: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    documentProcessingLog: {
      create: vi.fn().mockResolvedValue({})
    },
    documentEntity: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    notification: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  prisma.$transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
    Promise.all(operations)
  );

  return prisma;
}

function createJob(): Job<ProcessDocumentJobData> {
  return {
    data: {
      caseId: "case-1",
      documentId: "document-1",
      ownerId: "user-1"
    },
    name: "process_uploaded_document"
  } as Job<ProcessDocumentJobData>;
}

describe("document processing worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL =
      "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot?schema=public";
    mocks.analyzeCaseChecklist.mockResolvedValue({
      documentsAnalyzed: 1,
      foundCount: 2,
      matchCount: 1,
      missingCount: 3,
      status: "NEEDS_MORE_EVIDENCE"
    });
  });

  it("skips quarantined documents before reading storage", async () => {
    const prisma = createPrismaMock();
    prisma.document.findUnique.mockResolvedValue({
      id: "document-1",
      mimeType: "text/plain",
      originalName: "blocked.txt",
      quarantinedAt: new Date("2026-01-01T12:00:00.000Z"),
      storageKey: "users/user-1/cases/case-1/documents/document-1.txt",
      case: {
        id: "case-1",
        ownerId: "user-1",
        platform: "PayPal",
        title: "PayPal appeal"
      }
    });
    mocks.prisma = prisma;
    vi.resetModules();
    const { processUploadedDocument } = await import("./document-processing.processor.js");

    await processUploadedDocument(createJob());

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(mocks.readStoredObjectBytes).not.toHaveBeenCalled();
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-1",
        step: "process_uploaded_document",
        status: "skipped",
        message: "Worker skipped a quarantined document."
      }
    });
  });

  it("skips upload reservations claimed by the cleanup worker", async () => {
    const prisma = createPrismaMock();
    prisma.document.findUnique.mockResolvedValue({
      ...createDocument(),
      storageKey: "users/user-1/cases/case-1/upload-staging/document-1.txt",
      uploadExpiredAt: new Date("2026-01-02T12:00:00.000Z")
    });
    mocks.prisma = prisma;
    vi.resetModules();
    const { processUploadedDocument } = await import("./document-processing.processor.js");

    await processUploadedDocument(createJob());

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(mocks.readStoredObjectBytes).not.toHaveBeenCalled();
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-1",
        step: "process_uploaded_document",
        status: "skipped",
        message: "Worker skipped an expired upload reservation."
      }
    });
  });

  it("refreshes the checklist after successful document processing", async () => {
    const prisma = createPrismaMock();
    prisma.document.findUnique.mockResolvedValue(createDocument());
    mocks.prisma = prisma;
    mocks.readStoredObjectBytes.mockResolvedValue(
      Buffer.from("Your account is permanently limited. Support ticket 1234.")
    );
    vi.resetModules();
    const { processUploadedDocument } = await import("./document-processing.processor.js");

    const result = await processUploadedDocument(createJob());

    expect(mocks.analyzeCaseChecklist).toHaveBeenCalledWith(prisma, {
      auditAction: "case.checklist_auto_analyzed",
      caseId: "case-1",
      ownerId: "user-1",
      triggerDocumentId: "document-1"
    });
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-1",
        step: "refresh_case_checklist",
        status: "completed",
        message: "Checklist refreshed with 2 ready and 3 missing item(s)."
      }
    });
    expect(result).toEqual({
      documentId: "document-1",
      status: "PROCESSED"
    });
  });

  it("keeps a processed document successful when checklist refresh fails", async () => {
    const prisma = createPrismaMock();
    prisma.document.findUnique.mockResolvedValue(createDocument());
    mocks.prisma = prisma;
    mocks.readStoredObjectBytes.mockResolvedValue(Buffer.from("Support ticket response."));
    mocks.analyzeCaseChecklist.mockRejectedValue(new Error("Checklist database timeout"));
    vi.resetModules();
    const { processUploadedDocument } = await import("./document-processing.processor.js");

    const result = await processUploadedDocument(createJob());

    expect(result).toEqual({
      documentId: "document-1",
      status: "PROCESSED"
    });
    expect(prisma.document.update).not.toHaveBeenCalledWith({
      where: { id: "document-1" },
      data: { status: "FAILED" }
    });
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-1",
        step: "refresh_case_checklist",
        status: "failed",
        message: "Checklist database timeout"
      }
    });
  });

  it("records processing failure without an alert when evidence notifications are disabled", async () => {
    const prisma = createPrismaMock();
    const document = createDocument();
    document.case.owner.preference.notifyEvidenceProcessing = false;
    prisma.document.findUnique.mockResolvedValue(document);
    mocks.prisma = prisma;
    mocks.readStoredObjectBytes.mockRejectedValue(new Error("Storage read failed"));
    vi.resetModules();
    const { processUploadedDocument } = await import("./document-processing.processor.js");

    await expect(processUploadedDocument(createJob())).rejects.toThrow("Storage read failed");

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "document-1" },
      data: { status: "FAILED" }
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "document.processing_failed" })
      })
    );
  });

  it("queues an email-only processing failure notification", async () => {
    const prisma = createPrismaMock();
    const document = createDocument();
    document.case.owner.preference.inAppNotifications = false;
    prisma.document.findUnique.mockResolvedValue(document);
    mocks.prisma = prisma;
    mocks.readStoredObjectBytes.mockRejectedValue(new Error("Storage read failed"));
    vi.resetModules();
    const { processUploadedDocument } = await import("./document-processing.processor.js");

    await expect(processUploadedDocument(createJob())).rejects.toThrow("Storage read failed");

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailStatus: "PENDING",
        inAppVisible: false,
        type: "processing_failed"
      })
    });
  });
});

function createDocument() {
  return {
    id: "document-1",
    mimeType: "text/plain",
    originalName: "support-ticket.txt",
    quarantinedAt: null,
    storageKey: "users/user-1/cases/case-1/documents/document-1.txt",
    uploadExpiredAt: null,
    case: {
      id: "case-1",
      ownerId: "user-1",
      platform: "PayPal",
      title: "PayPal appeal",
      owner: {
        preference: {
          emailNotifications: true,
          inAppNotifications: true,
          notifyEvidenceProcessing: true
        }
      }
    }
  };
}
