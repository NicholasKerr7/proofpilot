CREATE TYPE "AppealSubmissionChannel" AS ENUM (
  'WEB_PORTAL',
  'EMAIL',
  'SUPPORT_CHAT',
  'MAIL',
  'FAX',
  'OTHER'
);

CREATE TYPE "AppealSubmissionStatus" AS ENUM (
  'SUBMITTED',
  'ACKNOWLEDGED',
  'UNDER_REVIEW',
  'ACTION_REQUIRED',
  'APPROVED',
  'DENIED',
  'CLOSED'
);

CREATE TYPE "SubmissionUpdateType" AS ENUM (
  'ACKNOWLEDGEMENT',
  'STATUS_CHANGE',
  'INFORMATION_REQUEST',
  'FOLLOW_UP',
  'DECISION',
  'NOTE'
);

CREATE TABLE "CaseSubmission" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "channel" "AppealSubmissionChannel" NOT NULL,
  "destination" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "confirmationCode" TEXT,
  "responseDueAt" TIMESTAMP(3),
  "status" "AppealSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "notes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaseSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmissionUpdate" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "type" "SubmissionUpdateType" NOT NULL,
  "status" "AppealSubmissionStatus",
  "title" TEXT NOT NULL,
  "details" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubmissionUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseSubmission_caseId_round_key"
ON "CaseSubmission"("caseId", "round");

CREATE INDEX "CaseSubmission_caseId_submittedAt_idx"
ON "CaseSubmission"("caseId", "submittedAt");

CREATE INDEX "CaseSubmission_caseId_status_idx"
ON "CaseSubmission"("caseId", "status");

CREATE INDEX "SubmissionUpdate_submissionId_occurredAt_idx"
ON "SubmissionUpdate"("submissionId", "occurredAt");

ALTER TABLE "CaseSubmission"
ADD CONSTRAINT "CaseSubmission_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubmissionUpdate"
ADD CONSTRAINT "SubmissionUpdate_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "CaseSubmission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
