-- CreateEnum
CREATE TYPE "PacketSharePermission" AS ENUM ('VIEW', 'COMMENT', 'DOWNLOAD');

-- CreateTable
CREATE TABLE "PacketShare" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "packetExportId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "requireEmailVerification" BOOLEAN NOT NULL DEFAULT false,
    "watermarkDocuments" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacketShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketShareRecipient" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "permission" "PacketSharePermission" NOT NULL DEFAULT 'VIEW',
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacketShareRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketShareComment" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacketShareComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PacketShare_tokenHash_key" ON "PacketShare"("tokenHash");

-- CreateIndex
CREATE INDEX "PacketShare_caseId_createdAt_idx" ON "PacketShare"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "PacketShare_packetExportId_idx" ON "PacketShare"("packetExportId");

-- CreateIndex
CREATE INDEX "PacketShareRecipient_shareId_permission_idx" ON "PacketShareRecipient"("shareId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "PacketShareRecipient_shareId_email_key" ON "PacketShareRecipient"("shareId", "email");

-- CreateIndex
CREATE INDEX "PacketShareComment_shareId_createdAt_idx" ON "PacketShareComment"("shareId", "createdAt");

-- CreateIndex
CREATE INDEX "PacketShareComment_recipientId_createdAt_idx" ON "PacketShareComment"("recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "PacketShare" ADD CONSTRAINT "PacketShare_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShare" ADD CONSTRAINT "PacketShare_packetExportId_fkey" FOREIGN KEY ("packetExportId") REFERENCES "PacketExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShare" ADD CONSTRAINT "PacketShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShareRecipient" ADD CONSTRAINT "PacketShareRecipient_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "PacketShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShareComment" ADD CONSTRAINT "PacketShareComment_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "PacketShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShareComment" ADD CONSTRAINT "PacketShareComment_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PacketShareRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
