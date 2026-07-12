-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoSave" BOOLEAN NOT NULL DEFAULT true,
    "confirmBeforeDelete" BOOLEAN NOT NULL DEFAULT true,
    "defaultCaseStatus" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "itemsPerPage" INTEGER NOT NULL DEFAULT 25,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notifyCaseUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyDeadlineReminders" BOOLEAN NOT NULL DEFAULT true,
    "notifyEvidenceProcessing" BOOLEAN NOT NULL DEFAULT true,
    "notifyPacketReady" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'DARK',
    "accentColor" TEXT NOT NULL DEFAULT 'COPPER',
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "cloudSync" BOOLEAN NOT NULL DEFAULT true,
    "syncOverCellular" BOOLEAN NOT NULL DEFAULT false,
    "exportFormat" TEXT NOT NULL DEFAULT 'PDF',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
