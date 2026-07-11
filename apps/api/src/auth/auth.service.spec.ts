import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { AuthService } from "./auth.service.js";

const bcryptMocks = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn()
}));

vi.mock("bcryptjs", () => bcryptMocks);

const userId = "user-1";
const createdAt = new Date("2026-05-04T12:00:00.000Z");

function createPrismaMock() {
  return {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    }
  };
}

function createJwtServiceMock() {
  return {
    signAsync: vi.fn().mockResolvedValue("signed-token")
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;
type JwtServiceMock = ReturnType<typeof createJwtServiceMock>;

function createService(prisma: PrismaMock, jwtService: JwtServiceMock) {
  return new AuthService(
    prisma as unknown as PrismaService,
    jwtService as unknown as JwtService
  );
}

describe("AuthService account management", () => {
  let prisma: PrismaMock;
  let jwtService: JwtServiceMock;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jwtService = createJwtServiceMock();
    service = createService(prisma, jwtService);
    vi.clearAllMocks();
  });

  it("trims and audits a profile name update", async () => {
    prisma.user.update.mockResolvedValue({
      id: userId,
      email: "nicholas.kerr@proofpilot.test",
      name: "Nicholas Kerr",
      createdAt
    });

    const result = await service.updateProfile(userId, { name: "  Nicholas Kerr  " });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: "Nicholas Kerr" },
      select: expect.any(Object)
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "auth.profile_updated",
        metadata: { fields: ["name"] }
      }
    });
    expect(result).toEqual({
      id: userId,
      email: "nicholas.kerr@proofpilot.test",
      name: "Nicholas Kerr",
      createdAt: createdAt.toISOString()
    });
  });

  it("rejects a blank profile name before writing", async () => {
    await expect(service.updateProfile(userId, { name: "   " })).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: "current-hash" });
    bcryptMocks.compare.mockResolvedValue(false);

    await expect(
      service.changePassword(userId, {
        currentPassword: "incorrect-password",
        newPassword: "new-secure-password"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(bcryptMocks.hash).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects reusing the current password", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: "current-hash" });
    bcryptMocks.compare.mockResolvedValue(true);

    await expect(
      service.changePassword(userId, {
        currentPassword: "same-password",
        newPassword: "same-password"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(bcryptMocks.hash).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("hashes and audits a password change without logging password data", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: "current-hash" });
    prisma.user.update.mockResolvedValue({ id: userId });
    bcryptMocks.compare.mockResolvedValue(true);
    bcryptMocks.hash.mockResolvedValue("new-password-hash");

    const result = await service.changePassword(userId, {
      currentPassword: "current-password",
      newPassword: "new-secure-password"
    });

    expect(bcryptMocks.hash).toHaveBeenCalledWith("new-secure-password", 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { passwordHash: "new-password-hash" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "auth.password_changed"
      }
    });
    expect(result).toEqual({ ok: true });
  });
});
