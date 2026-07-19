import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import { PacketSharePermission, PacketStatus } from "@proofpilot/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { PacketSharingService } from "./packet-sharing.service.js";

const storageMocks = vi.hoisted(() => ({
  createPresignedDownloadUrl: vi.fn()
}));

vi.mock("@proofpilot/storage", () => storageMocks);

const ownerId = "owner-1";
const caseId = "case-1";
const packetExportId = "packet-export-1";

function createPrismaMock() {
  const transactionClient = {
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    packetShare: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    }
  };

  return {
    transactionClient,
    $transaction: vi.fn(async (callback: (tx: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    case: {
      findFirst: vi.fn()
    },
    packetExport: {
      findFirst: vi.fn()
    },
    packetShare: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    packetShareComment: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([])
    },
    packetShareRecipient: {
      update: vi.fn().mockResolvedValue({})
    }
  };
}

function createJwtMock() {
  return {
    signAsync: vi.fn().mockResolvedValue("signed-access-token"),
    verifyAsync: vi.fn()
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;
type JwtMock = ReturnType<typeof createJwtMock>;

function createService(prisma: PrismaMock, jwt: JwtMock) {
  process.env.DATABASE_URL = "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot";
  process.env.JWT_SECRET = "proofpilot-test-secret-with-32-chars";
  process.env.WEB_ORIGIN = "https://app.proofpilot.test";

  return new PacketSharingService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService
  );
}

function createPacketExport() {
  return {
    byteSize: 2048,
    createdAt: new Date("2026-07-17T12:00:00.000Z"),
    id: packetExportId,
    packet: {
      id: "packet-1",
      case: {
        owner: { email: "owner@example.com" },
        title: "Account appeal"
      }
    },
    storageKey: "users/owner-1/cases/case-1/packets/packet-1.pdf"
  };
}

function createPublicShare(
  permission: PacketSharePermission = PacketSharePermission.VIEW,
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "share-1",
    createdById: ownerId,
    expiresAt: new Date("2026-07-25T12:00:00.000Z"),
    requireEmailVerification: false,
    revokedAt: null,
    packetExport: {
      byteSize: 2048,
      createdAt: new Date("2026-07-17T12:00:00.000Z"),
      storageKey: "users/owner-1/cases/case-1/packets/packet-1.pdf",
      packet: {
        id: "packet-1",
        case: {
          id: caseId,
          title: "Account appeal"
        }
      }
    },
    recipients: [
      {
        id: "recipient-1",
        email: "advisor@example.com",
        permission,
        lastAccessedAt: null
      }
    ],
    ...overrides
  };
}

describe("PacketSharingService", () => {
  let prisma: PrismaMock;
  let jwt: JwtMock;
  let service: PacketSharingService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
    prisma = createPrismaMock();
    jwt = createJwtMock();
    service = createService(prisma, jwt);
    storageMocks.createPresignedDownloadUrl.mockImplementation(
      async (input: { disposition?: string }) => `https://storage.test/${input.disposition}`
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("prepares only the owner's latest ready packet and active collaborators", async () => {
    prisma.case.findFirst.mockResolvedValue({
      title: "Account appeal",
      collaborators: [{ email: "advisor@example.com", name: "Advisor" }],
      packetShares: [],
      packets: [
        {
          id: "packet-1",
          exports: [
            {
              byteSize: 2048,
              createdAt: new Date("2026-07-17T12:00:00.000Z"),
              id: packetExportId
            }
          ]
        }
      ]
    });

    const result = await service.prepare(ownerId, caseId);

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: { archivedAt: null, id: caseId, ownerId },
      select: expect.any(Object)
    });
    expect(result).toMatchObject({
      capabilities: {
        comments: true,
        emailDelivery: false,
        emailVerification: false,
        watermarking: false
      },
      packet: { exportId: packetExportId, title: "Account appeal" },
      suggestedRecipients: [{ email: "advisor@example.com", name: "Advisor" }]
    });
  });

  it("revokes a share only through its explicit case owner scope", async () => {
    prisma.packetShare.findFirst.mockResolvedValue({ id: "share-1" });

    const result = await service.revoke(ownerId, caseId, "share-1");

    expect(prisma.packetShare.findFirst).toHaveBeenCalledWith({
      where: {
        case: { archivedAt: null, ownerId },
        caseId,
        id: "share-1",
        revokedAt: null
      },
      select: { id: true }
    });
    expect(prisma.transactionClient.packetShare.update).toHaveBeenCalledWith({
      data: { revokedAt: new Date("2026-07-18T12:00:00.000Z") },
      where: { id: "share-1" }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "case.packet_share_revoked",
        caseId,
        metadata: { shareId: "share-1" },
        userId: ownerId
      }
    });
    expect(result).toEqual({
      id: "share-1",
      revokedAt: "2026-07-18T12:00:00.000Z"
    });
  });

  it("does not revoke a share outside the case owner scope", async () => {
    prisma.packetShare.findFirst.mockResolvedValue(null);

    await expect(service.revoke(ownerId, caseId, "share-other")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("does not expose preparation data outside the case owner scope", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.prepare(ownerId, "case-other")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("stores only a token hash and redacts recipient emails from audit metadata", async () => {
    prisma.packetExport.findFirst.mockResolvedValue(createPacketExport());
    prisma.transactionClient.packetShare.create.mockResolvedValue({
      id: "share-1",
      createdAt: new Date(),
      expiresAt: new Date("2026-07-25T12:00:00.000Z"),
      requireEmailVerification: false,
      watermarkDocuments: false,
      recipients: [
        {
          id: "recipient-1",
          email: "advisor@example.com",
          permission: PacketSharePermission.COMMENT,
          lastAccessedAt: null
        }
      ]
    });

    const result = await service.create(ownerId, caseId, {
      expiresAt: "2026-07-25T12:00:00.000Z",
      packetExportId,
      recipients: [{ email: " Advisor@Example.COM ", permission: "COMMENT" }],
      requireEmailVerification: false,
      watermarkDocuments: false
    });
    const rawToken = result.shareUrl.split("#")[1];
    const createCall = prisma.transactionClient.packetShare.create.mock.calls[0]?.[0];

    expect(rawToken).toBeTruthy();
    if (!rawToken) {
      throw new Error("Expected the packet share URL to contain a fragment token.");
    }
    expect(createCall.data.tokenHash).toBe(
      createHash("sha256").update(rawToken).digest("hex")
    );
    expect(createCall.data.tokenHash).not.toBe(rawToken);
    expect(createCall.data.recipients.create).toEqual([
      { email: "advisor@example.com", permission: PacketSharePermission.COMMENT }
    ]);
    expect(prisma.packetExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: packetExportId,
          packet: {
            status: PacketStatus.READY,
            case: { archivedAt: null, id: caseId, ownerId }
          }
        }
      })
    );
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "case.packet_share_created",
        caseId,
        metadata: expect.objectContaining({ recipientCount: 1 }),
        userId: ownerId
      })
    });
    expect(
      prisma.transactionClient.auditLog.create.mock.calls[0]?.[0]?.data.metadata
    ).not.toHaveProperty("email");
  });

  it("rejects duplicate recipients and the case owner's email", async () => {
    await expect(
      service.create(ownerId, caseId, {
        packetExportId,
        recipients: [
          { email: "advisor@example.com", permission: "VIEW" },
          { email: " ADVISOR@example.com ", permission: "DOWNLOAD" }
        ],
        requireEmailVerification: false,
        watermarkDocuments: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.packetExport.findFirst.mockResolvedValue(createPacketExport());

    await expect(
      service.create(ownerId, caseId, {
        packetExportId,
        recipients: [{ email: " OWNER@example.com ", permission: "VIEW" }],
        requireEmailVerification: false,
        watermarkDocuments: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects unavailable email verification and watermarking options", async () => {
    await expect(
      service.create(ownerId, caseId, {
        packetExportId,
        recipients: [{ email: "advisor@example.com", permission: "VIEW" }],
        requireEmailVerification: true,
        watermarkDocuments: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(ownerId, caseId, {
        packetExportId,
        recipients: [{ email: "advisor@example.com", permission: "VIEW" }],
        requireEmailVerification: false,
        watermarkDocuments: true
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects expiration outside the five-minute to one-year window", async () => {
    await expect(
      service.create(ownerId, caseId, {
        expiresAt: "2026-07-18T12:04:00.000Z",
        packetExportId,
        recipients: [{ email: "advisor@example.com", permission: "VIEW" }],
        requireEmailVerification: false,
        watermarkDocuments: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(ownerId, caseId, {
        expiresAt: "2028-07-18T12:00:00.000Z",
        packetExportId,
        recipients: [{ email: "advisor@example.com", permission: "VIEW" }],
        requireEmailVerification: false,
        watermarkDocuments: false
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects expired public links before issuing access", async () => {
    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.VIEW, {
        expiresAt: new Date("2026-07-18T11:59:00.000Z")
      })
    );

    await expect(service.getPublicMetadata("raw-token")).rejects.toBeInstanceOf(
      GoneException
    );
  });

  it("issues scoped access only to an allowlisted recipient", async () => {
    prisma.packetShare.findUnique.mockResolvedValue(createPublicShare());

    await expect(
      service.createAccess({ email: "unknown@example.com", token: "raw-token" })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const result = await service.createAccess({
      email: " Advisor@Example.COM ",
      token: "raw-token"
    });

    expect(jwt.signAsync).toHaveBeenCalledWith(
      {
        shareId: "share-1",
        sub: "recipient-1",
        type: "packet-share-access"
      },
      { expiresIn: 3600 }
    );
    expect(prisma.packetShareRecipient.update).toHaveBeenCalledWith({
      data: { lastAccessedAt: new Date("2026-07-18T12:00:00.000Z") },
      where: { id: "recipient-1" }
    });
    expect(result.permission).toBe("VIEW");
  });

  it("only returns an attachment URL to recipients with download permission", async () => {
    jwt.verifyAsync.mockResolvedValue({
      shareId: "share-1",
      sub: "recipient-1",
      type: "packet-share-access"
    });
    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.VIEW)
    );

    const viewContent = await service.getContent("raw-token", "access-token");

    expect(viewContent.viewUrl).toBe("https://storage.test/inline");
    expect(viewContent.downloadUrl).toBeNull();

    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.DOWNLOAD)
    );
    const downloadContent = await service.getContent("raw-token", "access-token");

    expect(downloadContent.downloadUrl).toBe("https://storage.test/attachment");
  });

  it("rejects access tokens scoped to a different share", async () => {
    jwt.verifyAsync.mockResolvedValue({
      shareId: "share-other",
      sub: "recipient-1",
      type: "packet-share-access"
    });
    prisma.packetShare.findUnique.mockResolvedValue(createPublicShare());

    await expect(
      service.getContent("raw-token", "access-token")
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("allows comments for comment/download recipients but not view-only recipients", async () => {
    jwt.verifyAsync.mockResolvedValue({
      shareId: "share-1",
      sub: "recipient-1",
      type: "packet-share-access"
    });
    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.VIEW)
    );

    await expect(
      service.addComment("raw-token", "access-token", {
        content: "Please add the notice date.",
        token: "raw-token"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.COMMENT)
    );
    prisma.packetShareComment.create.mockResolvedValue({
      content: "Please add the notice date.",
      createdAt: new Date("2026-07-18T12:05:00.000Z"),
      id: "comment-1"
    });

    const result = await service.addComment("raw-token", "access-token", {
      content: "  Please add the notice date.  ",
      token: "raw-token"
    });

    expect(prisma.packetShareComment.create).toHaveBeenCalledWith({
      data: {
        content: "Please add the notice date.",
        recipientId: "recipient-1",
        shareId: "share-1"
      },
      select: { content: true, createdAt: true, id: true }
    });
    expect(result).toMatchObject({ id: "comment-1", isOwn: true });
  });
});
