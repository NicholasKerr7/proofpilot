import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { SettingsService } from "./settings.service.js";

const userId = "user-1";
const lastSyncedAt = new Date("2026-07-11T21:30:00.000Z");
const updatedAt = new Date("2026-07-11T21:31:00.000Z");

function createPreference(overrides: Record<string, unknown> = {}) {
  return {
    autoSave: true,
    confirmBeforeDelete: true,
    defaultCaseStatus: "DRAFT",
    itemsPerPage: 25,
    emailNotifications: true,
    inAppNotifications: true,
    notifyCaseUpdates: true,
    notifyDeadlineReminders: true,
    notifyEvidenceProcessing: true,
    notifyPacketReady: true,
    theme: "DARK",
    accentColor: "COPPER",
    reduceMotion: false,
    cloudSync: true,
    syncOverCellular: false,
    exportFormat: "PDF",
    analyticsUsageData: false,
    marketingCommunications: false,
    lastSyncedAt,
    updatedAt,
    ...overrides
  };
}

function createPrismaMock() {
  const transactionClient = {
    userPreference: {
      upsert: vi.fn()
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };
  const prisma = {
    userPreference: {
      upsert: vi.fn()
    },
    document: {
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: 3 },
        _sum: { byteSize: 2_000 }
      })
    },
    packetExport: {
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: 1 },
        _sum: { byteSize: 4_000 }
      })
    },
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    transactionClient
  };

  return prisma;
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe("SettingsService", () => {
  let prisma: PrismaMock;
  let service: SettingsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  it("loads or creates settings and scopes storage totals to the current user", async () => {
    prisma.userPreference.upsert.mockResolvedValue(createPreference());

    const result = await service.get(userId);

    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId },
      update: {},
      create: { userId },
      select: expect.any(Object)
    });
    expect(prisma.document.aggregate).toHaveBeenCalledWith({
      where: { case: { ownerId: userId } },
      _count: { _all: true },
      _sum: { byteSize: true }
    });
    expect(prisma.packetExport.aggregate).toHaveBeenCalledWith({
      where: { packet: { case: { ownerId: userId } } },
      _count: { _all: true },
      _sum: { byteSize: true }
    });
    expect(result.storage).toEqual({
      documentBytes: 2_000,
      documentCount: 3,
      exportBytes: 4_000,
      exportCount: 1,
      usedBytes: 6_000
    });
  });

  it("updates only the authenticated user's record and audits changed field names", async () => {
    prisma.transactionClient.userPreference.upsert.mockResolvedValue(
      createPreference({ accentColor: "TEAL", reduceMotion: true })
    );

    const result = await service.update(userId, {
      accentColor: "TEAL",
      reduceMotion: true
    });

    expect(prisma.transactionClient.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId },
      update: {
        accentColor: "TEAL",
        reduceMotion: true,
        lastSyncedAt: expect.any(Date)
      },
      create: {
        userId,
        accentColor: "TEAL",
        reduceMotion: true,
        lastSyncedAt: expect.any(Date)
      },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "settings.updated",
        metadata: { fields: ["accentColor", "reduceMotion"] }
      }
    });
    expect(result.accentColor).toBe("TEAL");
    expect(result.reduceMotion).toBe(true);
  });

  it("persists privacy consent fields through the owned preference record", async () => {
    prisma.transactionClient.userPreference.upsert.mockResolvedValue(
      createPreference({ analyticsUsageData: true, marketingCommunications: true })
    );

    const result = await service.update(userId, {
      analyticsUsageData: true,
      marketingCommunications: true
    });

    expect(prisma.transactionClient.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId },
      update: {
        analyticsUsageData: true,
        marketingCommunications: true,
        lastSyncedAt: expect.any(Date)
      },
      create: {
        userId,
        analyticsUsageData: true,
        marketingCommunications: true,
        lastSyncedAt: expect.any(Date)
      },
      select: expect.any(Object)
    });
    expect(result).toMatchObject({
      analyticsUsageData: true,
      marketingCommunications: true
    });
  });

  it("rejects empty or unsupported updates at the service boundary", async () => {
    await expect(service.update(userId, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(userId, { itemsPerPage: 75 as 25 })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(userId, { accentColor: "PURPLE" as "COPPER" })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("falls back from invalid stored option values without exposing them", async () => {
    prisma.userPreference.upsert.mockResolvedValue(
      createPreference({
        accentColor: "INVALID",
        defaultCaseStatus: "SUBMITTED",
        exportFormat: "DOCX",
        itemsPerPage: 500,
        theme: "NEON"
      })
    );

    const result = await service.get(userId);

    expect(result).toMatchObject({
      accentColor: "COPPER",
      defaultCaseStatus: "DRAFT",
      exportFormat: "PDF",
      itemsPerPage: 25,
      theme: "DARK"
    });
  });
});
