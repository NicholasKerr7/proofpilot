import type { PrismaService } from "../prisma/prisma.service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortfolioDemoWorkspaceService } from "./portfolio-demo-workspace.service.js";

const now = new Date("2026-07-22T16:00:00.000Z");
const expiresAt = new Date("2026-07-22T18:00:00.000Z");

function createWorkspace() {
  return {
    createdAt: new Date("2026-04-10T12:00:00.000Z"),
    email: "nicholas.kerr+visitor@portfolio.proofpilot.test",
    id: "portfolio-user-1",
    isPortfolioDemo: true,
    name: "Nicholas Kerr",
    portfolioDemoExpiresAt: expiresAt
  };
}

function createTemplate() {
  return {
    assistantThreads: [],
    auditLogs: [],
    billingSubscription: null,
    cases: [
      {
        archivedAt: null,
        caseTypeId: "case-type-1",
        checklist: [],
        collaborators: [],
        createdAt: new Date("2026-04-12T12:00:00.000Z"),
        deadline: new Date("2026-08-01T12:00:00.000Z"),
        events: [],
        id: "template-case-1",
        platform: "PayPal",
        reminders: [],
        sharingSettings: null,
        statementGuidance: null,
        statements: [],
        status: "NEEDS_MORE_EVIDENCE",
        summaries: [],
        summary: "Sample appeal summary",
        tasks: [],
        title: "PayPal account closure appeal"
      }
    ],
    connectedAccounts: [],
    createdAt: new Date("2026-04-10T12:00:00.000Z"),
    email: "nicholas.kerr@proofpilot.test",
    isPortfolioDemo: false,
    name: "Nicholas Kerr",
    notifications: [],
    passwordChangedAt: new Date("2026-04-10T12:00:00.000Z"),
    passwordHash: "bcrypt-hash",
    preference: null,
    supportRequests: []
  };
}

function createPrismaMock() {
  const transaction = {
    assistantThread: { create: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}), createMany: vi.fn() },
    authSession: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    billingSubscription: { create: vi.fn() },
    case: { create: vi.fn().mockResolvedValue({ id: "portfolio-case-1" }) },
    caseChecklistItem: { createMany: vi.fn() },
    caseCollaborator: { createMany: vi.fn() },
    caseEvent: { createMany: vi.fn() },
    caseSharingSettings: { create: vi.fn() },
    caseStatement: { create: vi.fn() },
    caseSummary: { createMany: vi.fn() },
    caseTask: { createMany: vi.fn() },
    connectedAccount: { createMany: vi.fn() },
    notification: { createMany: vi.fn() },
    reminder: { createMany: vi.fn() },
    statementGuidance: { create: vi.fn() },
    supportRequest: { create: vi.fn() },
    user: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(createWorkspace()),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    userPreference: { create: vi.fn() }
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction)
    ),
    transaction,
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(createTemplate())
    }
  };
  return prisma;
}

describe("PortfolioDemoWorkspaceService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("DATABASE_URL", "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot");
    vi.stubEnv("JWT_SECRET", "a-secure-test-secret-with-enough-length");
    vi.stubEnv("PORTFOLIO_DEMO_ACCESS_KEY", "portfolio-demo-test-key-with-32-characters");
    vi.stubEnv("PROOFPILOT_MODE", "portfolio");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("reuses an active workspace for the same browser visitor", async () => {
    const prisma = createPrismaMock();
    const workspace = createWorkspace();
    prisma.user.findFirst.mockResolvedValue(workspace);
    const service = new PortfolioDemoWorkspaceService(
      prisma as unknown as PrismaService
    );

    await expect(service.resolveWorkspace("a".repeat(43))).resolves.toEqual(workspace);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates an isolated case graph with a fixed expiry", async () => {
    const prisma = createPrismaMock();
    const service = new PortfolioDemoWorkspaceService(
      prisma as unknown as PrismaService
    );

    await expect(service.resolveWorkspace("b".repeat(43))).resolves.toEqual(
      createWorkspace()
    );

    expect(prisma.transaction.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: expect.stringMatching(
          /^nicholas\.kerr\+[0-9a-f-]+@portfolio\.proofpilot\.test$/
        ),
        isPortfolioDemo: true,
        portfolioDemoExpiresAt: expiresAt,
        portfolioDemoVisitorHash: expect.stringMatching(/^[a-f0-9]{64}$/)
      }),
      select: expect.any(Object)
    });
    expect(prisma.transaction.case.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "portfolio-user-1",
        title: "PayPal account closure appeal"
      }),
      select: { id: true }
    });
    expect(prisma.transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "portfolio.demo_workspace_created",
        metadata: {
          expiresAt: expiresAt.toISOString(),
          templateEmail: "nicholas.kerr@proofpilot.test"
        },
        userId: "portfolio-user-1"
      }
    });
  });
});
