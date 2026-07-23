-- CreateEnum
CREATE TYPE "PacketShareEmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateTable
CREATE TABLE "PacketShareAccessChallenge" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacketShareAccessChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketShareEmailDelivery" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "PacketShareEmailStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacketShareEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PacketShareAccessChallenge_shareId_recipientId_createdAt_idx" ON "PacketShareAccessChallenge"("shareId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "PacketShareAccessChallenge_expiresAt_idx" ON "PacketShareAccessChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "PacketShareEmailDelivery_status_nextAttemptAt_idx" ON "PacketShareEmailDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "PacketShareEmailDelivery_status_lastAttemptAt_idx" ON "PacketShareEmailDelivery"("status", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PacketShareEmailDelivery_shareId_recipientId_key" ON "PacketShareEmailDelivery"("shareId", "recipientId");

-- AddForeignKey
ALTER TABLE "PacketShareAccessChallenge" ADD CONSTRAINT "PacketShareAccessChallenge_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "PacketShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShareAccessChallenge" ADD CONSTRAINT "PacketShareAccessChallenge_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PacketShareRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShareEmailDelivery" ADD CONSTRAINT "PacketShareEmailDelivery_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "PacketShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketShareEmailDelivery" ADD CONSTRAINT "PacketShareEmailDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PacketShareRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
