import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { DocumentStatus } from "@proofpilot/database";
import { evidenceMaxUploadByteSize } from "@proofpilot/types/evidence";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { DocumentProcessingQueueService } from "../queue/document-processing-queue.service.js";
import { DocumentsService } from "./documents.service.js";
import type { VirusScannerService } from "./virus-scanner.service.js";

type PrismaMock = ReturnType<typeof createPrismaMock>;
type QueueMock = ReturnType<typeof createQueueMock>;
type ScannerMock = ReturnType<typeof createScannerMock>;

const storageMocks = vi.hoisted(() => ({
  copyStoredObject: vi.fn(),
  createPresignedDownloadUrl: vi.fn(),
  createPresignedUploadUrl: vi.fn(),
  deleteStoredObject: vi.fn(),
  headStoredObject: vi.fn(),
  writeStoredObjectBytes: vi.fn()
}));

const databaseMocks = vi.hoisted(() => ({
  analyzeCaseChecklist: vi.fn()
}));

vi.mock("@proofpilot/database", async () => {
  const actual = await vi.importActual<typeof import("@proofpilot/database")>(
    "@proofpilot/database"
  );

  return {
    ...actual,
    analyzeCaseChecklist: databaseMocks.analyzeCaseChecklist
  };
});

vi.mock("@proofpilot/storage", () => storageMocks);

const ownerId = "user-1";
const caseId = "case-1";
const documentId = "document-1";
const storageKey = "users/user-1/cases/case-1/documents/document-1.png";
const testSha256 = "a".repeat(64);

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
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    documentProcessingLog: {
      create: vi.fn().mockResolvedValue({})
    },
    documentVersion: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
}

function createQueueMock() {
  return {
    addProcessDocumentJob: vi.fn()
  };
}

function createScannerMock() {
  return {
    scanStoredObject: vi.fn()
  };
}

function createService(prisma: PrismaMock, queue: QueueMock, scanner: ScannerMock) {
  return new DocumentsService(
    prisma as unknown as PrismaService,
    queue as unknown as DocumentProcessingQueueService,
    scanner as unknown as VirusScannerService
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
    case: {
      ownerId,
      collaborators: [],
      sharingSettings: { preventDownloads: false }
    },
    byteSize: 1024,
    mimeType: "image/png",
    originalName: "proof.png",
    status: DocumentStatus.UPLOADED as DocumentStatus,
    storageKey,
    uploadExpiredAt: null as Date | null
  };
}

describe("DocumentsService upload hardening", () => {
  let prisma: PrismaMock;
  let queue: QueueMock;
  let scanner: ScannerMock;
  let service: DocumentsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    queue = createQueueMock();
    scanner = createScannerMock();
    service = createService(prisma, queue, scanner);
    vi.clearAllMocks();
    storageMocks.createPresignedUploadUrl.mockResolvedValue("https://storage.test/upload");
    storageMocks.copyStoredObject.mockResolvedValue({ etag: '"verified-etag"' });
    storageMocks.deleteStoredObject.mockResolvedValue(undefined);
    databaseMocks.analyzeCaseChecklist.mockResolvedValue({
      documentsAnalyzed: 0,
      foundCount: 0,
      matchCount: 0,
      missingCount: 4,
      status: "NEEDS_MORE_EVIDENCE"
    });
    scanner.scanStoredObject.mockResolvedValue({
      result: { engine: "clamav", status: "clean" },
      sha256: testSha256,
      sourceEtag: '"source-etag"'
    });
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

  it("writes provider evidence to private storage before entering normal processing", async () => {
    const createdAt = new Date("2026-07-22T12:00:00.000Z");
    prisma.case.findFirst.mockResolvedValue({ id: caseId, ownerId });
    prisma.document.create.mockResolvedValue({ id: documentId });
    prisma.document.findUnique.mockResolvedValue({
      byteSize: 18,
      createdAt,
      id: documentId,
      mimeType: "message/rfc822",
      originalName: "limitation-notice.eml",
      status: DocumentStatus.PROCESSING,
      updatedAt: createdAt
    });
    vi.spyOn(service, "completeUpload").mockResolvedValue({
      documentId,
      processingJob: { id: "job-1", name: "process_uploaded_document" }
    });

    const result = await service.importProviderEvidence(ownerId, caseId, {
      body: Buffer.from("provider evidence"),
      itemId: "gmail-limitation-notice",
      mimeType: "message/rfc822",
      originalName: "limitation-notice.eml",
      provider: "GMAIL"
    });

    expect(storageMocks.writeStoredObjectBytes).toHaveBeenCalledWith({
      body: expect.any(Buffer),
      contentType: "message/rfc822",
      key: expect.stringContaining(`users/${ownerId}/cases/${caseId}/upload-staging/`)
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "document.imported_from_provider",
        metadata: expect.objectContaining({
          documentId,
          itemId: "gmail-limitation-notice",
          provider: "GMAIL"
        })
      }
    });
    expect(result.document).toMatchObject({
      createdAt: createdAt.toISOString(),
      id: documentId,
      status: DocumentStatus.PROCESSING,
      updatedAt: createdAt.toISOString()
    });
  });

  it("removes an import reservation when provider storage fails", async () => {
    prisma.case.findFirst.mockResolvedValue({ id: caseId, ownerId });
    prisma.document.create.mockResolvedValue({ id: documentId });
    storageMocks.writeStoredObjectBytes.mockRejectedValueOnce(new Error("storage offline"));
    prisma.document.delete.mockResolvedValue({ id: documentId });

    await expect(
      service.importProviderEvidence(ownerId, caseId, {
        body: Buffer.from("provider evidence"),
        itemId: "gmail-limitation-notice",
        mimeType: "message/rfc822",
        originalName: "limitation-notice.eml",
        provider: "GMAIL"
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: documentId } });
    expect(prisma.auditLog.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "document.imported_from_provider" })
      })
    );
  });

  it("validates completed upload metadata before queueing processing", async () => {
    const document = createUploadedDocument();
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: "image/png",
      etag: '"source-etag"',
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    queue.addProcessDocumentJob.mockResolvedValue({
      id: "job-1",
      name: "process_uploaded_document"
    });

    const result = await service.completeUpload(ownerId, documentId);

    expect(storageMocks.headStoredObject).toHaveBeenCalledWith({ key: storageKey });
    expect(scanner.scanStoredObject).toHaveBeenCalledWith({ key: storageKey });
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId,
        step: "virus_scan",
        status: "completed",
        message: "ClamAV found no known threats in the uploaded file."
      }
    });
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId,
        step: "integrity_hash",
        status: "completed",
        message: "SHA-256 fingerprint recorded for provenance verification."
      }
    });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: { sha256: testSha256 }
    });
    expect(queue.addProcessDocumentJob).toHaveBeenCalledWith(
      {
        documentId,
        caseId,
        ownerId
      },
      { jobId: documentId }
    );
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: documentId,
        status: DocumentStatus.UPLOADED,
        uploadExpiredAt: null
      },
      data: { status: DocumentStatus.PROCESSING }
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
      data: {
        status: DocumentStatus.FAILED,
        quarantinedAt: expect.any(Date)
      }
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
    expect(scanner.scanStoredObject).not.toHaveBeenCalled();
  });

  it("deletes infected uploads and never queues processing", async () => {
    const document = createUploadedDocument();
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: document.mimeType,
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    scanner.scanStoredObject.mockResolvedValue({
      result: {
        engine: "clamav",
        status: "infected",
        threatName: "Eicar-Signature"
      },
      sha256: testSha256,
      sourceEtag: '"source-etag"'
    });

    await expect(service.completeUpload(ownerId, documentId)).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(storageMocks.deleteStoredObject).toHaveBeenCalledWith({ key: storageKey });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
        quarantinedAt: expect.any(Date)
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "document.virus_detected",
        metadata: {
          deleteError: null,
          documentId,
          engine: "clamav",
          objectDeleted: true,
          originalName: document.originalName,
          status: "infected",
          threatName: "Eicar-Signature"
        }
      }
    });
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("keeps uploads retryable when the scanner is unavailable", async () => {
    const document = createUploadedDocument();
    const scannerError = Object.assign(new Error("Connection refused"), {
      code: "ECONNREFUSED"
    });
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: document.mimeType,
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    scanner.scanStoredObject.mockRejectedValue(scannerError);

    await expect(service.completeUpload(ownerId, documentId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );

    expect(storageMocks.deleteStoredObject).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId,
        step: "virus_scan",
        status: "failed",
        message: "Upload security checks could not be completed; processing was not queued."
      }
    });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: documentId,
        quarantinedAt: null,
        status: DocumentStatus.PROCESSING,
        uploadExpiredAt: null
      },
      data: { status: DocumentStatus.UPLOADED }
    });
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("releases the completion claim when queueing fails", async () => {
    const document = createUploadedDocument();
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: document.mimeType,
      etag: '"source-etag"',
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    queue.addProcessDocumentJob.mockRejectedValue(new Error("Redis unavailable"));

    await expect(service.completeUpload(ownerId, documentId)).rejects.toThrow(
      "Redis unavailable"
    );

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: documentId,
        quarantinedAt: null,
        status: DocumentStatus.PROCESSING,
        uploadExpiredAt: null
      },
      data: { status: DocumentStatus.UPLOADED }
    });
  });

  it("does not issue download URLs for quarantined documents", async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...createUploadedDocument({ status: DocumentStatus.FAILED }),
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      entities: [],
      extractedText: null,
      processingLogs: [],
      quarantinedAt: new Date("2026-01-01T12:01:00.000Z"),
      updatedAt: new Date("2026-01-01T12:01:00.000Z")
    });

    const result = await service.get(ownerId, documentId);

    expect(result.downloadUrl).toBeNull();
    expect(storageMocks.createPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("does not issue download URLs before upload scanning completes", async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...createUploadedDocument(),
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      entities: [],
      extractedText: null,
      processingLogs: [],
      quarantinedAt: null,
      updatedAt: new Date("2026-01-01T12:00:00.000Z")
    });

    const result = await service.get(ownerId, documentId);

    expect(result.downloadUrl).toBeNull();
    expect(storageMocks.createPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("does not issue a download URL while a claimed staging upload is scanned", async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...createUploadedDocument({
        status: DocumentStatus.PROCESSING,
        storageKey: "users/user-1/cases/case-1/upload-staging/document-1.png"
      }),
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      entities: [],
      extractedText: null,
      processingLogs: [],
      quarantinedAt: null,
      updatedAt: new Date("2026-01-01T12:01:00.000Z")
    });

    const result = await service.get(ownerId, documentId);

    expect(result.downloadUrl).toBeNull();
    expect(storageMocks.createPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("does not complete or download an expired upload reservation", async () => {
    const uploadExpiredAt = new Date("2026-01-02T12:00:00.000Z");
    prisma.document.findFirst.mockResolvedValue(
      createUploadedDocument({ uploadExpiredAt })
    );

    await expect(service.completeUpload(ownerId, documentId)).rejects.toThrow(
      "This upload reservation has expired. Upload the file again."
    );
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();

    prisma.document.findFirst.mockResolvedValue({
      ...createUploadedDocument({
        status: DocumentStatus.FAILED,
        uploadExpiredAt
      }),
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      entities: [],
      extractedText: null,
      processingLogs: [],
      quarantinedAt: null,
      updatedAt: uploadExpiredAt
    });

    const result = await service.get(ownerId, documentId);

    expect(result.downloadUrl).toBeNull();
    expect(storageMocks.createPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("returns an expiry error when cleanup wins the completion claim", async () => {
    const uploadExpiredAt = new Date("2026-01-02T12:00:00.000Z");
    prisma.document.findFirst.mockResolvedValue(createUploadedDocument());
    prisma.document.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.document.findUnique.mockResolvedValue({
      status: DocumentStatus.FAILED,
      uploadExpiredAt
    });

    await expect(service.completeUpload(ownerId, documentId)).rejects.toThrow(
      "This upload reservation has expired. Upload the file again."
    );

    expect(storageMocks.headStoredObject).not.toHaveBeenCalled();
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("prevents quarantined documents from being reprocessed", async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: documentId,
      caseId,
      originalName: "blocked.txt",
      quarantinedAt: new Date("2026-01-01T12:01:00.000Z")
    });

    await expect(service.reprocess(ownerId, documentId)).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("prevents expired uploads from being reprocessed", async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: documentId,
      caseId,
      originalName: "expired.txt",
      quarantinedAt: null,
      uploadExpiredAt: new Date("2026-01-02T12:00:00.000Z")
    });

    await expect(service.reprocess(ownerId, documentId)).rejects.toThrow(
      "Expired uploads cannot be reprocessed."
    );

    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("requires upload completion before reprocessing can start", async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...createUploadedDocument(),
      quarantinedAt: null,
      updatedAt: new Date("2026-01-01T12:00:00.000Z")
    });

    await expect(service.reprocess(ownerId, documentId)).rejects.toThrow(
      "Upload completion is required before this document can be reprocessed."
    );

    expect(storageMocks.headStoredObject).not.toHaveBeenCalled();
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("does not enqueue duplicate processing for an active document", async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...createUploadedDocument({ status: DocumentStatus.PROCESSING }),
      quarantinedAt: null,
      updatedAt: new Date("2026-01-01T12:00:00.000Z")
    });

    await expect(service.reprocess(ownerId, documentId)).rejects.toThrow(
      "This document is already being processed."
    );

    expect(storageMocks.headStoredObject).not.toHaveBeenCalled();
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("rescans the promoted object before queueing reprocessing", async () => {
    const updatedAt = new Date("2026-01-01T12:00:00.000Z");
    const document = {
      ...createUploadedDocument({ status: DocumentStatus.PROCESSED }),
      quarantinedAt: null,
      updatedAt
    };
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: document.mimeType,
      etag: '"source-etag"',
      lastModified: updatedAt
    });
    queue.addProcessDocumentJob.mockResolvedValue({
      id: "reprocess-job-1",
      name: "process_uploaded_document"
    });

    await service.reprocess(ownerId, documentId);

    expect(scanner.scanStoredObject).toHaveBeenCalledWith({ key: storageKey });
    expect(storageMocks.copyStoredObject).not.toHaveBeenCalled();
    expect(queue.addProcessDocumentJob).toHaveBeenCalledWith({
      documentId,
      caseId,
      ownerId
    });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: documentId, updatedAt },
      data: { status: DocumentStatus.PROCESSING }
    });
  });

  it("records an explicit skip when scanning is disabled outside production", async () => {
    const document = createUploadedDocument();
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: document.mimeType,
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    scanner.scanStoredObject.mockResolvedValue({
      result: {
        engine: null,
        reason: "disabled",
        status: "skipped"
      },
      sha256: testSha256,
      sourceEtag: null
    });
    queue.addProcessDocumentJob.mockResolvedValue({
      id: documentId,
      name: "process_uploaded_document"
    });

    await service.completeUpload(ownerId, documentId);

    expect(prisma.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId,
        step: "virus_scan",
        status: "skipped",
        message: "Virus scanning is disabled in this non-production environment."
      }
    });
    expect(queue.addProcessDocumentJob).toHaveBeenCalledTimes(1);
  });

  it("promotes the exact scanned staging object before queueing processing", async () => {
    const stagingKey =
      "users/user-1/cases/case-1/upload-staging/document-1.png";
    const document = createUploadedDocument({ storageKey: stagingKey });
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: document.mimeType,
      etag: '"scanned-etag"',
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    scanner.scanStoredObject.mockResolvedValue({
      result: { engine: "clamav", status: "clean" },
      sha256: testSha256,
      sourceEtag: '"scanned-etag"'
    });
    queue.addProcessDocumentJob.mockResolvedValue({
      id: documentId,
      name: "process_uploaded_document"
    });

    await service.completeUpload(ownerId, documentId);

    const destinationKey =
      "users/user-1/cases/case-1/documents/document-1.png";
    expect(storageMocks.copyStoredObject).toHaveBeenCalledWith({
      destinationKey,
      sourceEtag: '"scanned-etag"',
      sourceKey: stagingKey
    });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: documentId,
        storageKey: stagingKey
      },
      data: { storageKey: destinationKey }
    });
    expect(prisma.documentVersion.updateMany).toHaveBeenCalledWith({
      where: {
        documentId,
        storageKey: stagingKey
      },
      data: { storageKey: destinationKey }
    });
    expect(storageMocks.deleteStoredObject).toHaveBeenCalledWith({ key: stagingKey });
    expect(queue.addProcessDocumentJob).toHaveBeenCalledTimes(1);
  });

  it("does not promote an object that changed after metadata validation", async () => {
    const stagingKey =
      "users/user-1/cases/case-1/upload-staging/document-1.png";
    const document = createUploadedDocument({ storageKey: stagingKey });
    prisma.document.findFirst.mockResolvedValue(document);
    storageMocks.headStoredObject.mockResolvedValue({
      byteSize: document.byteSize,
      contentType: document.mimeType,
      etag: '"metadata-etag"',
      lastModified: new Date("2026-01-01T12:00:00.000Z")
    });
    scanner.scanStoredObject.mockResolvedValue({
      result: { engine: "clamav", status: "clean" },
      sha256: testSha256,
      sourceEtag: '"replacement-etag"'
    });

    await expect(service.completeUpload(ownerId, documentId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );

    expect(storageMocks.copyStoredObject).not.toHaveBeenCalled();
    expect(storageMocks.deleteStoredObject).not.toHaveBeenCalled();
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "document.virus_scan_failed",
        metadata: {
          documentId,
          errorCode: "UPLOAD_ETAG_CHANGED",
          errorType: "Error",
          originalName: document.originalName,
          status: "failed"
        }
      }
    });
  });

  it("treats repeated completion calls as already completed", async () => {
    prisma.document.findFirst.mockResolvedValue(
      createUploadedDocument({ status: DocumentStatus.PROCESSING })
    );

    const result = await service.completeUpload(ownerId, documentId);

    expect(result).toEqual({
      documentId,
      alreadyCompleted: true,
      processingJob: {
        id: documentId,
        name: "process_uploaded_document"
      }
    });
    expect(storageMocks.headStoredObject).not.toHaveBeenCalled();
    expect(scanner.scanStoredObject).not.toHaveBeenCalled();
    expect(queue.addProcessDocumentJob).not.toHaveBeenCalled();
  });

  it("refreshes checklist matches after an owned document is deleted", async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: documentId,
      caseId,
      case: { ownerId },
      originalName: "proof.png",
      storageKey,
      versions: [{ storageKey: `${storageKey}.previous` }]
    });
    prisma.document.delete.mockResolvedValue({});

    const result = await service.remove(ownerId, documentId);

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: documentId,
        case: {
          OR: expect.any(Array),
          archivedAt: null
        }
      },
      select: expect.any(Object)
    });
    expect(databaseMocks.analyzeCaseChecklist).toHaveBeenCalledWith(prisma, {
      actorId: ownerId,
      auditAction: "case.checklist_auto_analyzed",
      caseId,
      ownerId,
      triggerDocumentId: documentId
    });
    expect(result).toEqual({ id: documentId, deleted: true });
  });
});
