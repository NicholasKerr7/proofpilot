ALTER TABLE "User"
ADD COLUMN "isPortfolioDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "portfolioDemoExpiresAt" TIMESTAMP(3),
ADD COLUMN "portfolioDemoVisitorHash" TEXT;

CREATE UNIQUE INDEX "User_portfolioDemoVisitorHash_key"
ON "User"("portfolioDemoVisitorHash");

CREATE INDEX "User_isPortfolioDemo_portfolioDemoExpiresAt_idx"
ON "User"("isPortfolioDemo", "portfolioDemoExpiresAt");
