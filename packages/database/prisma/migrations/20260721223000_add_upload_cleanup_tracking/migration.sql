-- Track and efficiently retry application-managed cleanup of abandoned staging uploads.
ALTER TABLE "Document"
ADD COLUMN "uploadExpiredAt" TIMESTAMP(3),
ADD COLUMN "uploadCleanupAttemptedAt" TIMESTAMP(3);

CREATE INDEX "Document_status_uploadExpiredAt_uploadCleanupAttemptedAt_idx"
ON "Document"("status", "uploadExpiredAt", "uploadCleanupAttemptedAt");
