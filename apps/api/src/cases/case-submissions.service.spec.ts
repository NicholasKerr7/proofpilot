import {
  AppealSubmissionChannel,
  AppealSubmissionStatus,
  CaseStatus,
  SubmissionUpdateType
} from "@proofpilot/database";
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CaseAccessGuard } from "./case-access.guard.js";
import { CaseSubmissionsService } from "./case-submissions.service.js";

const userId = "user-1";
const caseId = "case-1";

function createSubmissionRecord() {
  return {
    caseId,
    channel: AppealSubmissionChannel.WEB_PORTAL,
    confirmationCode: "PP-2026-0147",
    createdAt: new Date("2026-05-12T15:22:00.000Z"),
    destination: "PayPal Resolution Center",
    id: "submission-1",
    notes: "Submitted online.",
    resolvedAt: null,
    responseDueAt: new Date("2099-05-26T15:22:00.000Z"),
    round: 2,
    status: AppealSubmissionStatus.SUBMITTED,
    submittedAt: new Date("2026-05-12T15:22:00.000Z"),
    updatedAt: new Date("2026-05-12T15:22:00.000Z"),
    updates: []
  };
}

function createHarness() {
  const transaction = {
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    case: { update: vi.fn().mockResolvedValue({}) },
    caseSubmission: {
      aggregate: vi.fn().mockResolvedValue({ _max: { round: 1 } }),
      create: vi.fn().mockResolvedValue(createSubmissionRecord()),
      findUniqueOrThrow: vi.fn().mockResolvedValue(createSubmissionRecord()),
      update: vi.fn().mockResolvedValue({})
    },
    reminder: { create: vi.fn().mockResolvedValue({}) },
    submissionUpdate: { create: vi.fn().mockResolvedValue({}) }
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction)
    ),
    caseSubmission: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  };
  const access = {
    require: vi.fn().mockResolvedValue({ ownerId: userId })
  };

  return {
    access,
    prisma,
    service: new CaseSubmissionsService(
      prisma as unknown as PrismaService,
      access as unknown as CaseAccessGuard
    ),
    transaction
  };
}

describe("CaseSubmissionsService", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("creates the next appeal round, updates the case, and schedules follow-up", async () => {
    const { access, service, transaction } = createHarness();

    const result = await service.create(userId, caseId, {
      channel: "WEB_PORTAL",
      confirmationCode: "PP-2026-0147",
      destination: "PayPal Resolution Center",
      notes: "Submitted online.",
      responseDueAt: "2099-05-26T15:22:00.000Z",
      submittedAt: "2026-05-12T15:22:00.000Z"
    });

    expect(access.require).toHaveBeenCalledWith(userId, caseId, "EDIT");
    expect(transaction.caseSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          round: 2,
          status: AppealSubmissionStatus.SUBMITTED,
          updates: {
            create: expect.objectContaining({
              status: AppealSubmissionStatus.SUBMITTED,
              type: SubmissionUpdateType.STATUS_CHANGE
            })
          }
        })
      })
    );
    expect(transaction.case.update).toHaveBeenCalledWith({
      where: { id: caseId },
      data: { status: CaseStatus.SUBMITTED }
    });
    expect(transaction.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId,
        message: "Follow up on appeal round 2 if no response has arrived."
      })
    });
    expect(result).toMatchObject({ id: "submission-1", round: 2 });
  });

  it("records a denial and returns the case to review for another round", async () => {
    const { prisma, service, transaction } = createHarness();
    prisma.caseSubmission.findFirst.mockResolvedValue({
      id: "submission-1",
      round: 2,
      status: AppealSubmissionStatus.UNDER_REVIEW
    });
    transaction.caseSubmission.aggregate.mockResolvedValue({
      _max: { round: 2 }
    });
    transaction.caseSubmission.findUniqueOrThrow.mockResolvedValue({
      ...createSubmissionRecord(),
      status: AppealSubmissionStatus.DENIED
    });

    const result = await service.addUpdate(
      userId,
      caseId,
      "submission-1",
      {
        details: "PayPal upheld the limitation.",
        occurredAt: "2026-05-28T10:00:00.000Z",
        status: "DENIED",
        title: "Initial appeal denied",
        type: "DECISION"
      }
    );

    expect(transaction.submissionUpdate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AppealSubmissionStatus.DENIED,
        type: SubmissionUpdateType.DECISION
      })
    });
    expect(transaction.caseSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-1" },
      data: {
        resolvedAt: new Date("2026-05-28T10:00:00.000Z"),
        status: AppealSubmissionStatus.DENIED
      }
    });
    expect(transaction.case.update).toHaveBeenCalledWith({
      where: { id: caseId },
      data: { status: CaseStatus.READY_FOR_REVIEW }
    });
    expect(result.status).toBe(AppealSubmissionStatus.DENIED);
  });

  it("rejects response deadlines that precede submission", async () => {
    const { service } = createHarness();

    await expect(
      service.create(userId, caseId, {
        channel: "EMAIL",
        destination: "appeals@example.com",
        responseDueAt: "2026-05-11T15:22:00.000Z",
        submittedAt: "2026-05-12T15:22:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
