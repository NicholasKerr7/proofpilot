import { Injectable, NotFoundException } from "@nestjs/common";
import type { SecurityLoginActivity, SecurityOverview } from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";

const securityActivityActions = ["auth.logged_in", "auth.registered"];

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string): Promise<SecurityOverview> {
    const [user, activity] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordChangedAt: true }
      }),
      this.prisma.auditLog.findMany({
        where: {
          userId,
          action: { in: securityActivityActions },
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
      })
    ]);

    if (!user) {
      throw new NotFoundException("Security profile not found.");
    }

    return {
      biometricEnabled: false,
      capabilities: {
        biometricEnrollment: false,
        sessionRevocation: false,
        twoFactorEnrollment: false
      },
      loginActivity: activity.map((entry, index) => this.toLoginActivity(entry, index === 0)),
      passwordChangedAt: user.passwordChangedAt.toISOString(),
      twoFactorEnabled: false
    };
  }

  private toLoginActivity(
    entry: { createdAt: Date; id: string; metadata: unknown },
    isLatest: boolean
  ): SecurityLoginActivity {
    const metadata = getMetadata(entry.metadata);
    const userAgent = getMetadataString(metadata, "userAgent");

    return {
      deviceLabel:
        getMetadataString(metadata, "deviceLabel") ?? getDeviceLabel(userAgent),
      id: entry.id,
      isLatest,
      locationLabel:
        getMetadataString(metadata, "locationLabel") ??
        getLocationLabel(getMetadataString(metadata, "ipAddress")),
      occurredAt: entry.createdAt.toISOString()
    };
  }
}

function getMetadata(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
