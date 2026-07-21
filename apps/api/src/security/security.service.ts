import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  SecurityOverview,
  SecuritySession,
  SessionRevocationResponse
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string, currentSessionId: string): Promise<SecurityOverview> {
    const now = new Date();
    const [user, sessions] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordChangedAt: true }
      }),
      this.prisma.authSession.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: now }
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
      })
    ]);

    if (!user) {
      throw new NotFoundException("Security profile not found.");
    }

    return {
      biometricEnabled: false,
      capabilities: {
        biometricEnrollment: false,
        sessionRevocation: true,
        twoFactorEnrollment: false
      },
      passwordChangedAt: user.passwordChangedAt.toISOString(),
      sessions: sessions.map((session) => this.toSecuritySession(session, currentSessionId)),
      twoFactorEnabled: false
    };
  }

  async revokeSession(
    userId: string,
    currentSessionId: string,
    sessionId: string
  ): Promise<SessionRevocationResponse> {
    if (sessionId === currentSessionId) {
      throw new BadRequestException("Use sign out to end the current session.");
    }

    const revokedAt = new Date();
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: revokedAt }
      },
      data: { revokedAt }
    });

    if (!result.count) {
      throw new NotFoundException("Session not found.");
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "auth.session_revoked",
        metadata: { sessionId }
      }
    });

    return { ok: true, revokedCount: result.count };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string
  ): Promise<SessionRevocationResponse> {
    const revokedAt = new Date();
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
        expiresAt: { gt: revokedAt }
      },
      data: { revokedAt }
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "auth.other_sessions_revoked",
        metadata: { revokedCount: result.count }
      }
    });

    return { ok: true, revokedCount: result.count };
  }

  private toSecuritySession(
    session: {
      createdAt: Date;
      expiresAt: Date;
      id: string;
      ipAddress: string | null;
      lastSeenAt: Date;
      userAgent: string | null;
    },
    currentSessionId: string
  ): SecuritySession {
    const userAgent = session.userAgent;

    return {
      createdAt: session.createdAt.toISOString(),
      deviceLabel: getDeviceLabel(userAgent),
      expiresAt: session.expiresAt.toISOString(),
      id: session.id,
      isCurrent: session.id === currentSessionId,
      lastSeenAt: session.lastSeenAt.toISOString(),
      locationLabel: getLocationLabel(session.ipAddress)
    };
  }
}

function getDeviceLabel(userAgent: string | null) {
  if (!userAgent) {
    return "Unknown device";
  }

  const browser = getBrowserLabel(userAgent);

  if (/iPad/i.test(userAgent)) {
    return `${browser} on iPad`;
  }
  if (/iPhone/i.test(userAgent)) {
    return `${browser} on iPhone`;
  }
  if (/Android/i.test(userAgent)) {
    return `${browser} on Android`;
  }
  if (/Windows/i.test(userAgent)) {
    return `${browser} on Windows`;
  }
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return `${browser} on macOS`;
  }
  if (/Linux/i.test(userAgent)) {
    return `${browser} on Linux`;
  }

  return browser;
}

function getBrowserLabel(userAgent: string) {
  if (/Edg\//i.test(userAgent)) {
    return "Edge";
  }
  if (/Firefox\//i.test(userAgent)) {
    return "Firefox";
  }
  if (/Chrome\//i.test(userAgent)) {
    return "Chrome";
  }
  if (/Safari\//i.test(userAgent)) {
    return "Safari";
  }

  return "Browser";
}

function getLocationLabel(ipAddress: string | null) {
  if (!ipAddress) {
    return "Location unavailable";
  }

  return /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ipAddress)
    ? "Local development"
    : "Location unavailable";
}
