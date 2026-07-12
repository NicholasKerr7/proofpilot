-- CreateEnum
CREATE TYPE "ConnectionProvider" AS ENUM ('GMAIL', 'GOOGLE_DRIVE', 'DROPBOX', 'PAYPAL', 'ONEDRIVE', 'BOX');

-- CreateEnum
CREATE TYPE "ConnectionMode" AS ENUM ('DEMO', 'OAUTH');

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectionProvider" NOT NULL,
    "mode" "ConnectionMode" NOT NULL DEFAULT 'DEMO',
    "accountLabel" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_userId_provider_key" ON "ConnectedAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "ConnectedAccount_userId_updatedAt_idx" ON "ConnectedAccount"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
