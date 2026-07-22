-- Use notifications as a durable outbox for independent in-app and email delivery.
CREATE TYPE "NotificationEmailStatus" AS ENUM (
  'PENDING',
  'SENDING',
  'SENT',
  'FAILED',
  'SUPPRESSED'
);

ALTER TABLE "Notification"
ADD COLUMN "inAppVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "emailStatus" "NotificationEmailStatus",
ADD COLUMN "emailAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailNextAttemptAt" TIMESTAMP(3),
ADD COLUMN "emailLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailProviderId" TEXT,
ADD COLUMN "emailLastErrorCode" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_userId_inAppVisible_readAt_idx"
ON "Notification"("userId", "inAppVisible", "readAt");

CREATE INDEX "Notification_emailStatus_emailNextAttemptAt_idx"
ON "Notification"("emailStatus", "emailNextAttemptAt");
