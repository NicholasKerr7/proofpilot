CREATE TYPE "DocumentSource" AS ENUM (
  'FILE_UPLOAD',
  'CAMERA_SCAN',
  'PHOTO_LIBRARY',
  'EMAIL_ATTACHMENT',
  'GMAIL_IMPORT',
  'GOOGLE_DRIVE_IMPORT',
  'DROPBOX_IMPORT'
);

ALTER TABLE "Document"
  ADD COLUMN "source" "DocumentSource" NOT NULL DEFAULT 'FILE_UPLOAD',
  ADD COLUMN "sourceReference" TEXT,
  ADD COLUMN "sha256" TEXT;

CREATE INDEX "Document_caseId_source_idx" ON "Document"("caseId", "source");
