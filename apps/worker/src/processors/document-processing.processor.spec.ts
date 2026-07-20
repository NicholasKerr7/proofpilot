import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessDocumentJobData } from "../queues/document-processing.queue.js";

const mocks = vi.hoisted(() => ({
  prisma: undefined as unknown,
  readStoredObjectBytes: vi.fn()
}));

vi.mock("@proofpilot/database", () => ({
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
  return {
    document: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    documentProcessingLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };
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
});
