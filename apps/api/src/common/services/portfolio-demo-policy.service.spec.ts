import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service.js";
import type { RequestUser } from "../types/request-user.js";
import {
  portfolioDemoLimits,
  PortfolioDemoPolicyService
} from "./portfolio-demo-policy.service.js";

function createPrismaMock() {
  return {
    case: { count: vi.fn().mockResolvedValue(0) },
    casePacket: { count: vi.fn().mockResolvedValue(0) },
    document: { count: vi.fn().mockResolvedValue(0) }
  };
}

function createUser(isPortfolioDemo: boolean): RequestUser {
  return {
    email: "nicholas.kerr@proofpilot.test",
    id: "user-1",
    isPortfolioDemo,
    portfolioDemoExpiresAt: null,
    sessionId: "session-1"
  };
}

describe("PortfolioDemoPolicyService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PortfolioDemoPolicyService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PortfolioDemoPolicyService(prisma as unknown as PrismaService);
  });

  it("does not change standard account behavior", async () => {
    const user = createUser(false);

    expect(() => service.assertDirectUploadAllowed(user)).not.toThrow();
    expect(() => service.assertExternalDeliveryAllowed(user)).not.toThrow();
    await expect(service.assertCanCreateCase(user)).resolves.toBeUndefined();
    await expect(service.assertCanImportEvidence(user, 10)).resolves.toBeUndefined();
    await expect(service.assertCanGeneratePacket(user)).resolves.toBeUndefined();
    expect(prisma.case.count).not.toHaveBeenCalled();
  });

  it("blocks uploads and outbound delivery for portfolio visitors", () => {
    const user = createUser(true);

    expect(() => service.assertDirectUploadAllowed(user)).toThrow(ForbiddenException);
    expect(() => service.assertExternalDeliveryAllowed(user)).toThrow(ForbiddenException);
  });

  it("enforces case, evidence, and packet caps", async () => {
    const user = createUser(true);
    prisma.case.count.mockResolvedValue(portfolioDemoLimits.cases);
    prisma.document.count.mockResolvedValue(portfolioDemoLimits.evidenceDocuments - 1);
    prisma.casePacket.count.mockResolvedValue(portfolioDemoLimits.packetGenerations);

    await expect(service.assertCanCreateCase(user)).rejects.toMatchObject({
      status: 429
    });
    await expect(service.assertCanImportEvidence(user, 2)).rejects.toMatchObject({
      status: 429
    });
    await expect(service.assertCanGeneratePacket(user)).rejects.toMatchObject({
      status: 429
    });
  });
});
