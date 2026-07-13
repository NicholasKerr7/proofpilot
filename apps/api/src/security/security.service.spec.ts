import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { SecurityService } from "./security.service.js";

const userId = "user-1";
const passwordChangedAt = new Date("2026-04-10T12:00:00.000Z");

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn()
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([])
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

  it("returns owner-scoped password history and recent login activity", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordChangedAt });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-07-13T06:00:00.000Z"),
        id: "login-1",
        metadata: {
          ipAddress: "127.0.0.1",
          securityActivity: true,
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36"
        }
      },
      {
        createdAt: new Date("2026-07-12T06:00:00.000Z"),
        id: "login-2",
        metadata: {
          deviceLabel: "iPad Pro",
          locationLabel: "San Francisco, CA",
          securityActivity: true
        }
      }
    ]);

    const result = await service.getOverview(userId);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { passwordChangedAt: true }
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        action: { in: ["auth.logged_in", "auth.registered"] },
        metadata: {
          path: ["securityActivity"],
          equals: true
        }
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        createdAt: true,
        id: true,
        metadata: true
      }
    });
    expect(result).toMatchObject({
      passwordChangedAt: passwordChangedAt.toISOString(),
      twoFactorEnabled: false,
      biometricEnabled: false,
      capabilities: {
        biometricEnrollment: false,
        sessionRevocation: false,
        twoFactorEnrollment: false
      },
      loginActivity: [
        {
          deviceLabel: "Chrome on macOS",
          isLatest: true,
          locationLabel: "Local development"
        },
        {
          deviceLabel: "iPad Pro",
          isLatest: false,
          locationLabel: "San Francisco, CA"
        }
      ]
    });
  });

  it("uses non-sensitive fallbacks for incomplete activity metadata", async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordChangedAt });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-07-13T06:00:00.000Z"),
        id: "login-1",
        metadata: null
      }
    ]);

    const result = await service.getOverview(userId);

    expect(result.loginActivity[0]).toMatchObject({
      deviceLabel: "Unknown device",
      locationLabel: "Location unavailable"
    });
  });

  it("does not expose a security profile for a missing user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getOverview(userId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
