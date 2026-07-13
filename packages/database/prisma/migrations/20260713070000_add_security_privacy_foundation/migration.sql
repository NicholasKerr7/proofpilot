-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserPreference"
ADD COLUMN "analyticsUsageData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingCommunications" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AuditLog_userId_action_createdAt_idx" ON "AuditLog"("userId", "action", "createdAt");
