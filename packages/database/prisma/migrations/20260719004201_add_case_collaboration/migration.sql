-- CreateEnum
CREATE TYPE "CaseCollaboratorRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "CaseCollaboratorStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateTable
CREATE TABLE "CaseCollaborator" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "CaseCollaboratorRole" NOT NULL,
    "status" "CaseCollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseSharingSettings" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "preventDownloads" BOOLEAN NOT NULL DEFAULT false,
    "invitationExpiryDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseSharingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseCollaborator_caseId_status_idx" ON "CaseCollaborator"("caseId", "status");

-- CreateIndex
CREATE INDEX "CaseCollaborator_userId_status_idx" ON "CaseCollaborator"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CaseCollaborator_caseId_email_key" ON "CaseCollaborator"("caseId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CaseSharingSettings_caseId_key" ON "CaseSharingSettings"("caseId");

-- AddForeignKey
ALTER TABLE "CaseCollaborator" ADD CONSTRAINT "CaseCollaborator_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCollaborator" ADD CONSTRAINT "CaseCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseSharingSettings" ADD CONSTRAINT "CaseSharingSettings_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
