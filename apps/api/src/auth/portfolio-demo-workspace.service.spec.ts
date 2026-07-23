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
        checklist: [
          {
            createdAt: new Date("2026-04-12T13:00:00.000Z"),
            description: "Restriction notice",
            id: "template-checklist-1",
            label: "Account restriction",
            manuallyCompletedAt: null,
            requirementId: "requirement-1",
            status: "NEEDS_REVIEW"
          }
        ],
        collaborators: [],
        createdAt: new Date("2026-04-12T12:00:00.000Z"),
        deadline: new Date("2026-08-01T12:00:00.000Z"),
        documents: [
          {
            byteSize: 256,
            createdAt: new Date("2026-04-12T14:00:00.000Z"),
            entities: [
              {
                confidence: 0.94,
                createdAt: new Date("2026-04-12T14:01:00.000Z"),
                type: "DATE",
                value: "2026-05-04"
              }
            ],
            eventSources: [
              {
                createdAt: new Date("2026-04-12T14:02:00.000Z"),
                eventId: "template-event-1"
              }
            ],
            extractedText: "PayPal placed a permanent limitation on the account.",
            id: "template-document-1",
            mimeType: "message/rfc822",
            originalName: "limitation-notice.eml",
            processingLogs: [
              {
                createdAt: new Date("2026-04-12T14:03:00.000Z"),
                message: "Sample extraction is ready.",
                status: "COMPLETED",
                step: "TEXT_EXTRACTION"
              }
            ],
            requirementMatches: [
              {
                checklistItemId: "template-checklist-1",
                confidence: 0.94,
                createdAt: new Date("2026-04-12T14:04:00.000Z"),
                rationale: "Direct restriction notice",
                requirementId: "requirement-1"
              }
            ],
            sha256: "sample-sha256",
            source: "GMAIL_IMPORT",
            sourceReference: "gmail-limitation-notice",
            status: "NEEDS_REVIEW",
            storageKey: "demo-samples/evidence/limitation-notice.eml"
          }
        ],
        events: [
          {
            confidence: null,
            createdAt: new Date("2026-04-12T13:30:00.000Z"),
            description: "Restriction notice received.",
            id: "template-event-1",
            occurredAt: new Date("2026-05-04T12:00:00.000Z"),
            sortOrder: 0,
            title: "Account limitation"
          }
        ],
        id: "template-case-1",
        platform: "PayPal",
        reminders: [],
        sharingSettings: null,
        statementGuidance: null,
        statements: [],
        status: "NEEDS_MORE_EVIDENCE",
        summaries: [],
        submissions: [
          {
            channel: "WEB_PORTAL",
            confirmationCode: "PP-2026-0147",
            createdAt: new Date("2026-05-04T12:00:00.000Z"),
            destination: "PayPal Resolution Center",
            notes: "Initial appeal",
            resolvedAt: new Date("2026-05-20T12:00:00.000Z"),
            responseDueAt: new Date("2026-05-18T12:00:00.000Z"),
            round: 1,
            status: "DENIED",
            submittedAt: new Date("2026-05-04T12:00:00.000Z"),
            updates: [
              {
                createdAt: new Date("2026-05-20T12:00:00.000Z"),
                details: "Round two needs stronger ownership proof.",
                occurredAt: new Date("2026-05-20T12:00:00.000Z"),
                status: "DENIED",
                title: "Initial appeal denied",
                type: "DECISION"
              }
            ]
          }
        ],
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
    caseChecklistItem: {
      create: vi.fn().mockResolvedValue({ id: "portfolio-checklist-1" })
    },
    caseCollaborator: { createMany: vi.fn() },
    caseEvent: {
      create: vi.fn().mockResolvedValue({ id: "portfolio-event-1" })
    },
    caseRequirementMatch: { createMany: vi.fn() },
    caseSharingSettings: { create: vi.fn() },
    caseSubmission: { create: vi.fn() },
    caseStatement: { create: vi.fn() },
    caseSummary: { createMany: vi.fn() },
    caseTask: { createMany: vi.fn() },
    connectedAccount: { createMany: vi.fn() },
    document: {
      create: vi.fn().mockResolvedValue({ id: "portfolio-document-1" })
    },
    documentEntity: { createMany: vi.fn() },
    documentProcessingLog: { createMany: vi.fn() },
    eventSource: { createMany: vi.fn() },
    notification: { createMany: vi.fn() },
    reminder: { createMany: vi.fn() },
    statementGuidance: { create: vi.fn() },
    supportRequest: { create: vi.fn() },
    user: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(createWorkspace()),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
      findUnique: vi.fn().mockResolvedValue(createTemplate()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
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
    expect(prisma.transaction.caseRequirementMatch.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          checklistItemId: "portfolio-checklist-1",
          documentId: "portfolio-document-1",
          requirementId: "requirement-1"
        })
      ]
    });
    expect(prisma.transaction.eventSource.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          documentId: "portfolio-document-1",
          eventId: "portfolio-event-1"
        })
      ]
    });
    expect(prisma.transaction.caseSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "portfolio-case-1",
        confirmationCode: "PP-2026-0147",
        round: 1,
        updates: {
          create: [
            expect.objectContaining({
              status: "DENIED",
              title: "Initial appeal denied"
            })
          ]
        }
      })
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

  it("expires the visitor workspace before rebuilding a clean demo", async () => {
    const prisma = createPrismaMock();
    const service = new PortfolioDemoWorkspaceService(
      prisma as unknown as PrismaService
    );

    await expect(service.resetWorkspace("c".repeat(43))).resolves.toEqual(
      createWorkspace()
    );

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        isPortfolioDemo: true,
        portfolioDemoVisitorHash: expect.stringMatching(/^[a-f0-9]{64}$/)
      },
      data: {
        portfolioDemoExpiresAt: now,
        portfolioDemoVisitorHash: null
      }
    });
    expect(prisma.transaction.case.create).toHaveBeenCalled();
  });
});
