import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

function createRequest(authorization = "Bearer signed-token") {
  return {
    headers: { authorization },
    user: undefined
  };
}

function createContext(request: ReturnType<typeof createRequest>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function createJwtServiceMock() {
  return {
    verifyAsync: vi.fn().mockResolvedValue({
      email: "signed@example.com",
      sid: "session-1",
      sub: "user-1"
    })
  };
}

function createPrismaMock() {
  return {
    authSession: {
      findFirst: vi.fn().mockResolvedValue({
        id: "session-1",
        lastSeenAt: new Date(),
        user: { email: "current@example.com" }
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
}

describe("JwtAuthGuard", () => {
  let jwtService: ReturnType<typeof createJwtServiceMock>;
  let prisma: ReturnType<typeof createPrismaMock>;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = createJwtServiceMock();
    prisma = createPrismaMock();
    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService
    );
  });

  it("accepts only an active owner-linked session", async () => {
    const request = createRequest();

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      select: {
        id: true,
        lastSeenAt: true,
        user: { select: { email: true } }
      }
    });
    expect(request.user).toEqual({
      email: "current@example.com",
      id: "user-1",
      sessionId: "session-1"
    });
  });

  it("rejects a valid JWT after its session is revoked", async () => {
    prisma.authSession.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext(createRequest()))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects legacy JWTs that do not contain a session ID", async () => {
    jwtService.verifyAsync.mockResolvedValue({
      email: "signed@example.com",
      sub: "user-1"
    });

    await expect(
      guard.canActivate(createContext(createRequest()))
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
  });

  it("throttles last-seen persistence to stale sessions", async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      id: "session-1",
      lastSeenAt: new Date(Date.now() - 10 * 60 * 1_000),
      user: { email: "current@example.com" }
    });

    await guard.canActivate(createContext(createRequest()));

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        revokedAt: null
      },
      data: { lastSeenAt: expect.any(Date) }
    });
  });
});
