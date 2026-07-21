-- AlterTable
ALTER TABLE "CaseCollaborator" ADD COLUMN "inviteTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CaseCollaborator_inviteTokenHash_key" ON "CaseCollaborator"("inviteTokenHash");
