import { DocumentStatus, type PrismaClient } from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  abandonedUploadAgeMs,
  expireAbandonedUploadBatch,
  uploadCleanupRetryDelayMs
} from "./upload-cleanup.processor.js";

const now = new Date("2026-07-21T16:00:00.000Z");
const oldUpdatedAt = new Date(now.getTime() - abandonedUploadAgeMs - 1);

function createPrismaMock() {
  const transactionClient = {
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    document: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    documentProcessingLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (transaction: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient)
    ),
    document: {
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    transactionClient
  };

  return prisma;
}

function createDeleteObjectMock() {
  return vi.fn(async (_input: { key: string }) => undefined);
}

function createAbandonedDocument(
  overrides: Partial<ReturnType<typeof baseAbandonedDocument>> = {}
) {
  return {
    ...baseAbandonedDocument(),
    ...overrides
  };
}

function baseAbandonedDocument() {
  return {
    id: "document-1",
    caseId: "case-1",
    originalName: "abandoned-proof.png",
    status: DocumentStatus.UPLOADED as DocumentStatus,
    storageKey: "users/user-1/cases/case-1/upload-staging/document-1.png",
    updatedAt: oldUpdatedAt,
    uploadCleanupAttemptedAt: null as Date | null,
    uploadExpiredAt: null as Date | null,
    case: { ownerId: "user-1" }
  };
}

describe("expireAbandonedUploadBatch", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let deleteObject: ReturnType<typeof createDeleteObjectMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    deleteObject = createDeleteObjectMock();
  });

  it("atomically claims and removes stale staging uploads", async () => {
    const document = createAbandonedDocument();
    prisma.document.findMany.mockResolvedValue([document]);

    await expect(
      expireAbandonedUploadBatch(
        prisma as unknown as PrismaClient,
        now,
        deleteObject
      )
    ).resolves.toEqual({
      claimed: 1,
      contended: 0,
      deleted: 1,
      examined: 1,
      failed: 0,
      retried: 0
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: expect.objectContaining({
          storageKey: { contains: "/upload-staging/" }
        })
      })
    );
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: document.id,
        status: DocumentStatus.UPLOADED,
        storageKey: document.storageKey,
        updatedAt: oldUpdatedAt,
        uploadExpiredAt: null
      },
      data: {
        status: DocumentStatus.FAILED,
        uploadCleanupAttemptedAt: now,
        uploadExpiredAt: now
      }
    });
    expect(deleteObject).toHaveBeenCalledWith({ key: document.storageKey });
    expect(prisma.transactionClient.document.deleteMany).toHaveBeenCalledWith({
      where: {
        id: document.id,
        status: DocumentStatus.FAILED,
        storageKey: document.storageKey,
        uploadCleanupAttemptedAt: now,
        uploadExpiredAt: now
      }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "document.abandoned_upload_expired",
        caseId: "case-1",
        metadata: {
          documentId: document.id,
          expiredAt: now.toISOString(),
          originalName: document.originalName,
          storageObjectDeleted: true
        },
        userId: "user-1"
      }
    });
  });

  it("does not delete an upload when another request wins the claim", async () => {
    prisma.document.findMany.mockResolvedValue([createAbandonedDocument()]);
    prisma.document.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      expireAbandonedUploadBatch(
        prisma as unknown as PrismaClient,
        now,
        deleteObject
      )
    ).resolves.toEqual({
      claimed: 0,
      contended: 1,
      deleted: 0,
      examined: 1,
      failed: 0,
      retried: 0
    });

    expect(deleteObject).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("retains a failed cleanup with sanitized diagnostics for a later retry", async () => {
    const document = createAbandonedDocument();
    prisma.document.findMany.mockResolvedValue([document]);
    deleteObject.mockRejectedValue(
      Object.assign(new Error("private storage details"), { code: "ECONNRESET" })
    );

    await expect(
      expireAbandonedUploadBatch(
        prisma as unknown as PrismaClient,
        now,
        deleteObject
      )
    ).resolves.toEqual({
      claimed: 1,
      contended: 0,
      deleted: 0,
      examined: 1,
      failed: 1,
      retried: 0
    });

    expect(prisma.transactionClient.document.deleteMany).not.toHaveBeenCalled();
    expect(prisma.transactionClient.documentProcessingLog.create).toHaveBeenCalledWith({
      data: {
        documentId: document.id,
        message: "Staging object cleanup failed and will be retried.",
        status: "failed",
        step: "upload_cleanup"
      }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "document.abandoned_upload_cleanup_failed",
          metadata: expect.objectContaining({
            errorCode: "ECONNRESET",
            errorType: "Error",
            retryable: true
          })
        })
      })
    );
    expect(JSON.stringify(prisma.transactionClient.auditLog.create.mock.calls)).not.toContain(
      "private storage details"
    );
  });

  it("leases and retries a previously failed cleanup after the retry delay", async () => {
    const uploadExpiredAt = new Date("2026-07-20T15:00:00.000Z");
    const previousAttempt = new Date(
      now.getTime() - uploadCleanupRetryDelayMs - 1
    );
    const document = createAbandonedDocument({
      status: DocumentStatus.FAILED,
      uploadCleanupAttemptedAt: previousAttempt,
      uploadExpiredAt
    });
    prisma.document.findMany.mockResolvedValue([document]);

    const result = await expireAbandonedUploadBatch(
      prisma as unknown as PrismaClient,
      now,
      deleteObject
    );

    expect(result).toMatchObject({ claimed: 1, deleted: 1, retried: 1 });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: document.id,
        status: DocumentStatus.FAILED,
        storageKey: document.storageKey,
        uploadCleanupAttemptedAt: previousAttempt,
        uploadExpiredAt
      },
      data: { uploadCleanupAttemptedAt: now }
    });
  });
});
