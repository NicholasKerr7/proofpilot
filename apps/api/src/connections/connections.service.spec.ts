import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { ConnectionsService } from "./connections.service.js";

const userId = "user-1";
const connectedAt = new Date("2026-07-12T00:00:00.000Z");
const lastSyncedAt = new Date("2026-07-12T00:15:00.000Z");

function createConnection(overrides: Record<string, unknown> = {}) {
  return {
    accountLabel: "nicholas@example.com",
    connectedAt,
    lastSyncedAt,
    mode: "DEMO",
    provider: "GMAIL",
    ...overrides
  };
}

function createPrismaMock() {
  const transactionClient = {
    connectedAccount: {
      delete: vi.fn().mockResolvedValue({})
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };
  const prisma = {
    connectedAccount: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    transactionClient
  };

  return prisma;
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe("ConnectionsService", () => {
  let prisma: PrismaMock;
  let service: ConnectionsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ConnectionsService(prisma as unknown as PrismaService);
  });

  it("lists the provider catalog using only the authenticated user's records", async () => {
    prisma.connectedAccount.findMany.mockResolvedValue([
      createConnection(),
      createConnection({ provider: "GOOGLE_DRIVE" })
    ]);

    const result = await service.list(userId);

    expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: expect.any(Object)
    });
    expect(result).toHaveLength(6);
    expect(result[0]).toMatchObject({
      accountLabel: "nicholas@example.com",
      authorizationConfigured: false,
      mode: "DEMO",
      provider: "GMAIL",
      status: "CONNECTED"
    });
    expect(result.at(-1)).toMatchObject({
      accountLabel: null,
      provider: "BOX",
      status: "NOT_CONNECTED"
    });
  });

  it("disconnects through the owner-scoped compound key and audits no account details", async () => {
    prisma.connectedAccount.findUnique.mockResolvedValue(createConnection());

    const result = await service.disconnect(userId, "GMAIL");

    expect(prisma.connectedAccount.findUnique).toHaveBeenCalledWith({
      where: { userId_provider: { userId, provider: "GMAIL" } },
      select: expect.any(Object)
    });
    expect(prisma.transactionClient.connectedAccount.delete).toHaveBeenCalledWith({
      where: { userId_provider: { userId, provider: "GMAIL" } }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "connection.disconnected",
        metadata: { provider: "GMAIL" }
      }
    });
    expect(result).toMatchObject({ provider: "GMAIL", status: "NOT_CONNECTED" });
  });

  it("does not allow a user to disconnect an account they do not own", async () => {
    prisma.connectedAccount.findUnique.mockResolvedValue(null);

    await expect(service.disconnect(userId, "PAYPAL")).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported providers at the service boundary", async () => {
    await expect(service.disconnect(userId, "SLACK")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(() => service.connect(userId, "SLACK")).toThrow(BadRequestException);
  });

  it("does not create a fake connection when OAuth is unavailable", () => {
    expect(() => service.connect(userId, "ONEDRIVE")).toThrow(
      ServiceUnavailableException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
