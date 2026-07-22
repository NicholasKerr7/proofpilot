import { Prisma } from "@proofpilot/database";

export const authUserSelect = {
  createdAt: true,
  email: true,
  id: true,
  isPortfolioDemo: true,
  name: true,
  portfolioDemoExpiresAt: true
} satisfies Prisma.UserSelect;

export type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect;
}>;
