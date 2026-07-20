-- AlterTable
ALTER TABLE "CaseEvent" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill the existing chronology with a stable zero-based display order.
WITH ranked_events AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "caseId"
            ORDER BY "occurredAt" ASC, "createdAt" ASC, "id" ASC
        ) - 1 AS "position"
    FROM "CaseEvent"
)
UPDATE "CaseEvent"
SET "sortOrder" = ranked_events."position"
FROM ranked_events
WHERE "CaseEvent"."id" = ranked_events."id";

-- CreateIndex
CREATE INDEX "CaseEvent_caseId_sortOrder_idx" ON "CaseEvent"("caseId", "sortOrder");
