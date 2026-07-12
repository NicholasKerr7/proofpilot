import { CaseStatus } from "@proofpilot/database";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { PacketGenerationQueueService } from "../queue/packet-generation-queue.service.js";
import { CasesService } from "./cases.service.js";

const ownerId = "owner-1";
const caseType = {
  id: "case-type-1",
  slug: "account-ban-appeal",
  name: "Account Ban / Appeal Builder",
  description: "Build an appeal packet."
};

function createService(defaultCaseStatus: CaseStatus | null) {
  const createdCase = {
    id: "case-1",
    ownerId,
    caseTypeId: caseType.id,
    title: "PayPal appeal",
    platform: "PayPal",
    status: defaultCaseStatus ?? CaseStatus.DRAFT
  };
  const transactionClient = {
    case: {
      create: vi.fn().mockResolvedValue(createdCase),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...createdCase, caseType })
    },
    caseTemplate: {
      findFirst: vi.fn().mockResolvedValue({ requirements: [] })
    },
    caseChecklistItem: {
      createMany: vi.fn()
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };
  const prisma = {
    caseType: {
      findUnique: vi.fn().mockResolvedValue(caseType)
    },
    userPreference: {
      findUnique: vi.fn().mockResolvedValue(
        defaultCaseStatus === null ? null : { defaultCaseStatus }
      )
    },
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    transactionClient
  };
  const queue = { addGeneratePacketJob: vi.fn() };

  return {
    prisma,
    service: new CasesService(
      prisma as unknown as PrismaService,
      queue as unknown as PacketGenerationQueueService
    )
  };
}

describe("CasesService case creation preferences", () => {
  it("uses the owner's supported default case status", async () => {
    const { prisma, service } = createService(CaseStatus.COLLECTING_EVIDENCE);

    await service.create(ownerId, {
      title: "PayPal appeal",
      platform: "PayPal"
    });

    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: ownerId },
      select: { defaultCaseStatus: true }
    });
    expect(prisma.transactionClient.case.create).toHaveBeenCalledWith({
      data: {
        ownerId,
        caseTypeId: caseType.id,
        title: "PayPal appeal",
        platform: "PayPal",
        status: CaseStatus.COLLECTING_EVIDENCE
      }
    });
  });

  it("defaults new cases to draft when no preference exists", async () => {
    const { prisma, service } = createService(null);

    await service.create(ownerId, {
      title: "PayPal appeal",
      platform: "PayPal"
    });

    expect(prisma.transactionClient.case.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: CaseStatus.DRAFT })
    });
  });

  it("does not allow a later workflow status to become a creation default", async () => {
    const { prisma, service } = createService(CaseStatus.SUBMITTED);

    await service.create(ownerId, {
      title: "PayPal appeal",
      platform: "PayPal"
    });

    expect(prisma.transactionClient.case.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: CaseStatus.DRAFT })
    });
  });
});
