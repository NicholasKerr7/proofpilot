-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Reminder_caseId_remindAt_idx" ON "Reminder"("caseId", "remindAt");
