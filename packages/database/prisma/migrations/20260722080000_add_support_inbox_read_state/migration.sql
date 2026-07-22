ALTER TABLE "SupportRequest"
ADD COLUMN "readAt" TIMESTAMP(3);

UPDATE "SupportRequest"
SET "readAt" = "updatedAt";

CREATE INDEX "SupportRequest_userId_readAt_idx"
ON "SupportRequest"("userId", "readAt");
