CREATE TABLE "StatementGuidance" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "platformAction" TEXT,
    "actionDate" TEXT,
    "reasonGiven" TEXT,
    "accountUse" TEXT,
    "supportContact" TEXT,
    "requestedOutcome" TEXT,
    "supportingDocuments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementGuidance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatementGuidance_caseId_key" ON "StatementGuidance"("caseId");

ALTER TABLE "StatementGuidance"
ADD CONSTRAINT "StatementGuidance_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
