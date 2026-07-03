import { BadRequestException } from "@nestjs/common";
import { DocumentStatus } from "@proofpilot/database";
import { evidenceMaxUploadByteSize } from "@proofpilot/types/evidence";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { DocumentProcessingQueueService } from "../queue/document-processing-queue.service.js";
import { DocumentsService } from "./documents.service.js";

type PrismaMock = ReturnType<typeof createPrismaMock>;
type QueueMock = ReturnType<typeof createQueueMock>;

const storageMocks = vi.hoisted(() => ({
  createPresignedDownloadUrl: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  deleteStoredObject: vi.fn(),
  headStoredObject: vi.fn()
}));

vi.mock("@proofpilot/storage", () => storageMocks);

const ownerId = "user-1";
const caseId = "case-1";
const documentId = "document-1";
const storageKey = "users/user-1/cases/case-1/documents/document-1.png";

function createPrismaMock() {
  return {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    case: {
      findFirst: vi.fn()
    },
    document: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    documentProcessingLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };
}

function createQueueMock() {
  return {
    addProcessDocumentJob: vi.fn()
  };
}

function createService(prisma: PrismaMock, queue: QueueMock) {
  return new DocumentsService(
    prisma as unknown as PrismaService,
    queue as unknown as DocumentProcessingQueueService
  );
}

function createUploadedDocument(overrides: Partial<ReturnType<typeof baseUploadedDocument>> = {}) {
  return {
    ...baseUploadedDocument(),
    ...overrides
  };
}

function baseUploadedDocument() {
  return {
    id: documentId,
    caseId,
    byteSize: 1024,
    mimeType: "image/png",
    originalName: "proof.png",
    status: DocumentStatus.UPLOADED,
    storageKey
  };
}

describe("DocumentsService upload hardening", () => {
  let prisma: PrismaMock;
  let queue: QueueMock;
  let service: DocumentsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    queue = createQueueMock();
    service = createService(prisma, queue);
    vi.clearAllMocks();
    storageMocks.createPresignedUploadUrl.mockResolvedValue("https://storage.test/upload");
    storageMocks.deleteStoredObject.mockResolvedValue(undefined);
  });

  it("rejects oversized upload reservations before creating a document", async () => {
    await expect(
      service.create(ownerId, caseId, {
        byteSize: evidenceMaxUploadByteSize + 1,
        mimeType: "image/png",
        originalName: "oversized.png"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.case.findFirst).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(storageMocks.createPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("validates completed upload metadata before queueing processing", async () => {
    const document = createUploadedDocument();
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: "image/png",
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    queue.addProcessDocumentJob.mockResolvedValue({
      id: "job-1",
      name: "process_uploaded_document"
    });

    const result = await service.completeUpload(ownerId, documentId);

    expect(storageMocks.headStoredObject).toHaveBeenCalledWith({ key: storageKey });
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId,
        step: "virus_scan_placeholder",
        status: "skipped",
        message:
          "Virus scanning provider is not configured; upload metadata passed validation before processing."
      }
    });
    expect(queue.addProcessDocumentJob).toHaveBeenCalledWith({
      documentId,
      caseId,
      ownerId
    });
    expect(result.processingJob).toEqual({
      id: "job-1",
      name: "process_uploaded_document"
    });
  });

  it("rejects completed uploads when stored byte size does not match reservation", async () => {
    const document = createUploadedDocument();
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize + 1,
      contentType: "image/png",
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });

    await expect(service.completeUpload(ownerId, documentId)).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(storageMocks.deleteStoredObject).toHaveBeenCalledWith({ key: storageKey });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: { status: DocumentStatus.FAILED }
    });
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId,
        step: "upload_validation",
        status: "failed",
        message: "Uploaded file size did not match the reserved upload."
      }
    });
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });
});
