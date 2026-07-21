import {
  DocumentStatus,
  getPrismaClient,
  type PrismaClient
} from "@proofpilot/database";
import { deleteStoredObject } from "@proofpilot/storage";
import type { Job } from "bullmq";
import type { ExpireAbandonedUploadsJobData } from "../queues/upload-cleanup.queue.js";

export const abandonedUploadAgeMs = 24 * 60 * 60 * 1_000;
export const uploadCleanupRetryDelayMs = 15 * 60 * 1_000;
const uploadCleanupBatchSize = 100;
const uploadStagingKeySegment = "/upload-staging/";

type DeleteStoredObject = typeof deleteStoredObject;

export interface UploadCleanupResult {
  claimed: number;
  contended: number;
  deleted: number;
  examined: number;
  failed: number;
  retried: number;
}

export async function expireAbandonedUploads(
  _job: Job<ExpireAbandonedUploadsJobData>
) {
  return expireAbandonedUploadBatch(getPrismaClient());
}

export async function expireAbandonedUploadBatch(
  client: PrismaClient,
  now = new Date(),
  deleteObject: DeleteStoredObject = deleteStoredObject
): Promise<UploadCleanupResult> {
  const expirationCutoff = new Date(now.getTime() - abandonedUploadAgeMs);
  const retryCutoff = new Date(now.getTime() - uploadCleanupRetryDelayMs);
  const documents = await client.document.findMany({
    where: {
      storageKey: { contains: uploadStagingKeySegment },
      OR: [
        {
          status: {
            in: [DocumentStatus.UPLOADED, DocumentStatus.PROCESSING]
          },
          updatedAt: { lte: expirationCutoff },
          uploadExpiredAt: null
        },
        {
          status: DocumentStatus.FAILED,
          uploadExpiredAt: { not: null },
          OR: [
            { uploadCleanupAttemptedAt: null },
            { uploadCleanupAttemptedAt: { lte: retryCutoff } }
          ]
        }
      ]
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      caseId: true,
      originalName: true,
      status: true,
      storageKey: true,
      updatedAt: true,
      uploadCleanupAttemptedAt: true,
      uploadExpiredAt: true,
      case: {
        select: { ownerId: true }
      }
    },
    take: uploadCleanupBatchSize
  });
  const result: UploadCleanupResult = {
    claimed: 0,
    contended: 0,
    deleted: 0,
    examined: documents.length,
    failed: 0,
    retried: 0
  };

  for (const document of documents) {
    const isRetry = document.uploadExpiredAt !== null;
    const claim = await client.document.updateMany({
      where: isRetry
        ? {
            id: document.id,
            status: DocumentStatus.FAILED,
            storageKey: document.storageKey,
            uploadCleanupAttemptedAt: document.uploadCleanupAttemptedAt,
            uploadExpiredAt: document.uploadExpiredAt
          }
        : {
            id: document.id,
            status: document.status,
            storageKey: document.storageKey,
            updatedAt: document.updatedAt,
            uploadExpiredAt: null
          },
      data: isRetry
        ? { uploadCleanupAttemptedAt: now }
        : {
            status: DocumentStatus.FAILED,
            uploadCleanupAttemptedAt: now,
            uploadExpiredAt: now
          }
    });

    if (!claim.count) {
      result.contended += 1;
      continue;
    }

    result.claimed += 1;
    result.retried += Number(isRetry);
    const uploadExpiredAt = document.uploadExpiredAt ?? now;

    try {
      await deleteObject({ key: document.storageKey });
    } catch (error) {
      await recordCleanupFailure(client, document, uploadExpiredAt, now, error);
      result.failed += 1;
      continue;
    }

    const deleted = await client.$transaction(async (transaction) => {
      const removal = await transaction.document.deleteMany({
        where: {
          id: document.id,
          status: DocumentStatus.FAILED,
          storageKey: document.storageKey,
          uploadCleanupAttemptedAt: now,
          uploadExpiredAt
        }
      });

      if (!removal.count) {
        return false;
      }

      await transaction.auditLog.create({
        data: {
          action: "document.abandoned_upload_expired",
          caseId: document.caseId,
          metadata: {
            documentId: document.id,
            expiredAt: uploadExpiredAt.toISOString(),
            originalName: document.originalName,
            storageObjectDeleted: true
          },
          userId: document.case.ownerId
        }
      });

      return true;
    });

    if (deleted) {
      result.deleted += 1;
    } else {
      result.contended += 1;
    }
  }

  return result;
}

async function recordCleanupFailure(
  client: PrismaClient,
  document: {
    case: { ownerId: string };
    caseId: string;
    id: string;
    originalName: string;
    storageKey: string;
  },
  uploadExpiredAt: Date,
  attemptedAt: Date,
  error: unknown
) {
  await client.$transaction(async (transaction) => {
    const retained = await transaction.document.updateMany({
      where: {
        id: document.id,
        status: DocumentStatus.FAILED,
        storageKey: document.storageKey,
        uploadCleanupAttemptedAt: attemptedAt,
        uploadExpiredAt
      },
      data: { uploadCleanupAttemptedAt: attemptedAt }
    });

    if (!retained.count) {
      return;
    }

    await transaction.documentProcessingLog.create({
      data: {
        documentId: document.id,
        message: "Staging object cleanup failed and will be retried.",
        status: "failed",
        step: "upload_cleanup"
      }
    });
    await transaction.auditLog.create({
      data: {
        action: "document.abandoned_upload_cleanup_failed",
        caseId: document.caseId,
        metadata: {
          documentId: document.id,
          errorCode: getErrorCode(error),
          errorType: error instanceof Error ? error.name : "UnknownError",
          expiredAt: uploadExpiredAt.toISOString(),
          originalName: document.originalName,
          retryable: true
        },
        userId: document.case.ownerId
      }
    });
  });
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.slice(0, 80);
  }

  return null;
}
