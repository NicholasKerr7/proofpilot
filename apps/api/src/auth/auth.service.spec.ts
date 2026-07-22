import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { AuthService } from "./auth.service.js";
import type { PasswordResetMailerService } from "./password-reset-mailer.service.js";
import type { PortfolioDemoWorkspaceService } from "./portfolio-demo-workspace.service.js";

const bcryptMocks = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn()
}));

vi.mock("bcryptjs", () => bcryptMocks);

const userId = "user-1";
const currentSessionId = "session-current";
const createdAt = new Date("2026-05-04T12:00:00.000Z");

function createPrismaMock() {
  const prisma = {
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    authSession: {
      create: vi.fn().mockResolvedValue({ id: currentSessionId }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    passwordResetToken: {
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn()
  };

  prisma.$transaction.mockImplementation(async (operation) => {
    if (typeof operation === "function") {
      return operation(prisma);
    }
    return Promise.all(operation);
  });

  return prisma;
}

function createJwtServiceMock() {
  return {
    signAsync: vi.fn().mockResolvedValue("signed-token")
  };
}

function createPasswordResetMailerMock() {
  return {
    send: vi.fn().mockResolvedValue(undefined)
  };
}

function createPortfolioDemoWorkspaceMock() {
  return {
    resolveWorkspace: vi.fn()
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;
type JwtServiceMock = ReturnType<typeof createJwtServiceMock>;
type PasswordResetMailerMock = ReturnType<typeof createPasswordResetMailerMock>;
type PortfolioDemoWorkspaceMock = ReturnType<typeof createPortfolioDemoWorkspaceMock>;

function createService(
  prisma: PrismaMock,
  jwtService: JwtServiceMock,
  passwordResetMailer: PasswordResetMailerMock,
  portfolioDemoWorkspaces: PortfolioDemoWorkspaceMock = createPortfolioDemoWorkspaceMock()
) {
  return new AuthService(
    prisma as unknown as PrismaService,
    jwtService as unknown as JwtService,
    passwordResetMailer as unknown as PasswordResetMailerService,
    portfolioDemoWorkspaces as unknown as PortfolioDemoWorkspaceService
  );
}

describe("AuthService account management", () => {
  let prisma: PrismaMock;
  let jwtService: JwtServiceMock;
  let passwordResetMailer: PasswordResetMailerMock;
  let service: AuthService;

  beforeEach(() => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot"
    );
    vi.stubEnv("JWT_SECRET", "a-secure-test-secret-with-enough-length");
    prisma = createPrismaMock();
    jwtService = createJwtServiceMock();
    passwordResetMailer = createPasswordResetMailerMock();
    service = createService(prisma, jwtService, passwordResetMailer);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trims and audits a profile name update", async () => {
    prisma.user.update.mockResolvedValue({
      id: userId,
      email: "nicholas.kerr@proofpilot.test",
      isPortfolioDemo: false,
      name: "Nicholas Kerr",
      createdAt,
      portfolioDemoExpiresAt: null
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
      isPortfolioDemo: false,
      name: "Nicholas Kerr",
      createdAt: createdAt.toISOString(),
      portfolioDemoExpiresAt: null
    });
  });

  it("rejects a blank profile name before writing", async () => {
    await expect(service.updateProfile(userId, { name: "   " })).rejects.toBeInstanceOf(
      BadRequestException
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("creates a server-side session with sanitized client context", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: "nicholas.kerr@proofpilot.test",
      isPortfolioDemo: false,
      name: "Nicholas Kerr",
      passwordHash: "current-hash",
      createdAt,
      portfolioDemoExpiresAt: null
    });
    bcryptMocks.compare.mockResolvedValue(true);

    await service.login(
      {
        email: "nicholas.kerr@proofpilot.test",
        password: "current-password"
      },
      {
        ipAddress: " 127.0.0.1 ",
        userAgent: "ProofPilot\nBrowser"
      }
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "auth.logged_in",
        metadata: {
          email: "nicholas.kerr@proofpilot.test",
          ipAddress: "127.0.0.1",
          securityActivity: true,
          userAgent: "ProofPilot Browser"
        }
      }
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: {
        userId,
        expiresAt: expect.any(Date),
        ipAddress: "127.0.0.1",
        userAgent: "ProofPilot Browser"
      },
      select: { id: true }
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {
        sub: userId,
        email: "nicholas.kerr@proofpilot.test",
        sid: currentSessionId
      },
      { expiresIn: expect.any(Number) }
    );
  });

  it("rejects an incorrect current password", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: "current-hash" });
    bcryptMocks.compare.mockResolvedValue(false);

    await expect(
      service.changePassword(userId, currentSessionId, {
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
      service.changePassword(userId, currentSessionId, {
        currentPassword: "same-password",
        newPassword: "same-password"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(bcryptMocks.hash).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("changes the password and revokes every other session", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: "current-hash" });
    prisma.user.update.mockResolvedValue({ id: userId });
    bcryptMocks.compare.mockResolvedValue(true);
    bcryptMocks.hash.mockResolvedValue("new-password-hash");

    const result = await service.changePassword(userId, currentSessionId, {
      currentPassword: "current-password",
      newPassword: "new-secure-password"
    });

    expect(bcryptMocks.hash).toHaveBeenCalledWith("new-secure-password", 12);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null
      },
      data: { revokedAt: expect.any(Date) }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "auth.password_changed"
      }
    });
    expect(result).toEqual({
      ok: true,
      passwordChangedAt: expect.any(String)
    });
  });

  it("returns the same reset acknowledgement for an unknown email", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await service.requestPasswordReset({ email: "unknown@example.com" });

    expect(response).toEqual({
      ok: true,
      message: "If an account exists for that email, a password reset link has been sent."
    });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(passwordResetMailer.send).not.toHaveBeenCalled();
  });

  it("stores only a reset token hash and sends the raw token in a time-limited link", async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: "nicholas.kerr@proofpilot.test",
      id: userId
    });
    prisma.passwordResetToken.create.mockResolvedValue({ id: "reset-1" });

    await service.requestPasswordReset({ email: "NICHOLAS.KERR@PROOFPILOT.TEST" });

    const resetUrl = new URL(passwordResetMailer.send.mock.calls[0]?.[0].resetUrl);
    const rawToken = resetUrl.searchParams.get("resetToken");
    const storedHash = prisma.passwordResetToken.create.mock.calls[0]?.[0].data.tokenHash;

    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(storedHash).toBe(
      createHash("sha256").update(rawToken ?? "").digest("hex")
    );
    expect(storedHash).not.toBe(rawToken);
    expect(passwordResetMailer.send).toHaveBeenCalledWith({
      resetUrl: expect.stringContaining("resetToken="),
      to: "nicholas.kerr@proofpilot.test"
    });
  });

  it("atomically redeems a reset token and revokes all sessions", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: "reset-1",
      usedAt: null,
      user: {
        id: userId,
        passwordHash: "current-hash"
      },
      userId
    });
    bcryptMocks.compare.mockResolvedValue(false);
    bcryptMocks.hash.mockResolvedValue("new-password-hash");

    const result = await service.resetPassword({
      token: "A".repeat(43),
      newPassword: "new-secure-password"
    });

    expect(prisma.passwordResetToken.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "reset-1",
        usedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      data: { usedAt: expect.any(Date) }
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        passwordChangedAt: expect.any(Date),
        passwordHash: "new-password-hash"
      }
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an expired reset token before changing credentials", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 60_000),
      id: "reset-1",
      usedAt: null,
      user: {
        id: userId,
        passwordHash: "current-hash"
      },
      userId
    });

    await expect(
      service.resetPassword({
        token: "A".repeat(43),
        newPassword: "new-secure-password"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("hides standard credential endpoints in portfolio mode", async () => {
    vi.stubEnv("PROOFPILOT_MODE", "portfolio");
    vi.stubEnv("PORTFOLIO_DEMO_ACCESS_KEY", "portfolio-demo-test-key-with-32-characters");
    service = createService(prisma, jwtService, passwordResetMailer);

    await expect(
      service.login({ email: "user@example.com", password: "password-123" })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("requires the server-only key and limits a portfolio session to workspace expiry", async () => {
    vi.stubEnv("PROOFPILOT_MODE", "portfolio");
    vi.stubEnv("PORTFOLIO_DEMO_ACCESS_KEY", "portfolio-demo-test-key-with-32-characters");
    const portfolioDemoWorkspaces = createPortfolioDemoWorkspaceMock();
    const workspaceExpiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    portfolioDemoWorkspaces.resolveWorkspace.mockResolvedValue({
      createdAt,
      email: "nicholas.kerr+visitor@portfolio.proofpilot.test",
      id: userId,
      isPortfolioDemo: true,
      name: "Nicholas Kerr",
      portfolioDemoExpiresAt: workspaceExpiresAt
    });
    service = createService(
      prisma,
      jwtService,
      passwordResetMailer,
      portfolioDemoWorkspaces
    );

    await expect(
      service.createPortfolioDemo("v".repeat(43), "wrong-key")
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(portfolioDemoWorkspaces.resolveWorkspace).not.toHaveBeenCalled();

    const response = await service.createPortfolioDemo(
      "v".repeat(43),
      "portfolio-demo-test-key-with-32-characters"
    );

    expect(response.user).toMatchObject({
      email: "nicholas.kerr@proofpilot.test",
      isPortfolioDemo: true,
      portfolioDemoExpiresAt: workspaceExpiresAt.toISOString()
    });
    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: {
        expiresAt: workspaceExpiresAt,
        userId
      },
      select: { id: true }
    });
  });
});
