import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { SecurityService } from "./security.service.js";

const userId = "user-1";
const currentSessionId = "session-current";
const passwordChangedAt = new Date("2026-04-10T12:00:00.000Z");

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn()
    },
    authSession: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe("SecurityService", () => {
  let prisma: PrismaMock;
  let service: SecurityService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SecurityService(prisma as unknown as PrismaService);
  });

  it("returns only active owner sessions and identifies the current one", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordChangedAt });
    prisma.authSession.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-07-13T06:00:00.000Z"),
        expiresAt: new Date("2027-07-13T06:00:00.000Z"),
        id: currentSessionId,
        ipAddress: "127.0.0.1",
        lastSeenAt: new Date("2026-07-13T07:00:00.000Z"),
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36"
      },
      {
        createdAt: new Date("2026-07-12T06:00:00.000Z"),
        expiresAt: new Date("2027-07-12T06:00:00.000Z"),
        id: "session-tablet",
        ipAddress: null,
        lastSeenAt: new Date("2026-07-12T08:00:00.000Z"),
        userAgent: "Mozilla/5.0 (iPad) AppleWebKit/605.1.15 Safari/604.1"
      }
    ]);

    const result = await service.getOverview(userId, currentSessionId);

    expect(prisma.authSession.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      orderBy: { lastSeenAt: "desc" },
      take: 10,
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        ipAddress: true,
        lastSeenAt: true,
        userAgent: true
      }
    });
    expect(result).toMatchObject({
      passwordChangedAt: passwordChangedAt.toISOString(),
      capabilities: {
        biometricEnrollment: false,
        sessionRevocation: true,
        twoFactorEnrollment: false
      },
      sessions: [
        {
          deviceLabel: "Chrome on macOS",
          id: currentSessionId,
          isCurrent: true,
          locationLabel: "Local development"
        },
        {
          deviceLabel: "Safari on iPad",
          id: "session-tablet",
          isCurrent: false,
          locationLabel: "Location unavailable"
        }
      ]
    });
  });

  it("uses non-sensitive fallbacks for incomplete session metadata", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordChangedAt });
    prisma.authSession.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-07-13T06:00:00.000Z"),
        expiresAt: new Date("2027-07-13T06:00:00.000Z"),
        id: currentSessionId,
        ipAddress: null,
        lastSeenAt: new Date("2026-07-13T07:00:00.000Z"),
        userAgent: null
      }
    ]);

    const result = await service.getOverview(userId, currentSessionId);

    expect(result.sessions[0]).toMatchObject({
      deviceLabel: "Unknown device",
      locationLabel: "Location unavailable"
    });
  });

  it("does not expose a security profile for a missing user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.getOverview(userId, currentSessionId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("requires the logout flow for the current session", async () => {
    await expect(
      service.revokeSession(userId, currentSessionId, currentSessionId)
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("revokes a session through an owner-scoped update", async () => {
    const result = await service.revokeSession(
      userId,
      currentSessionId,
      "session-tablet"
    );

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-tablet",
        userId,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      data: { revokedAt: expect.any(Date) }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "auth.session_revoked",
        metadata: { sessionId: "session-tablet" }
      }
    });
    expect(result).toEqual({ ok: true, revokedCount: 1 });
  });

  it("revokes every active session except the caller", async () => {
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.revokeOtherSessions(userId, currentSessionId);

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      data: { revokedAt: expect.any(Date) }
    });
    expect(result).toEqual({ ok: true, revokedCount: 2 });
  });
});
