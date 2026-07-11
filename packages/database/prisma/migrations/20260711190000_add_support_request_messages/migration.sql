-- CreateEnum
CREATE TYPE "SupportMessageAuthor" AS ENUM ('USER', 'SUPPORT', 'SYSTEM');

-- CreateTable
CREATE TABLE "SupportRequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "author" "SupportMessageAuthor" NOT NULL DEFAULT 'USER',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequestMessage_requestId_createdAt_idx" ON "SupportRequestMessage"("requestId", "createdAt");

-- ReplaceIndex
DROP INDEX "SupportRequest_userId_createdAt_idx";
CREATE INDEX "SupportRequest_userId_updatedAt_idx" ON "SupportRequest"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "SupportRequestMessage" ADD CONSTRAINT "SupportRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
