import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import { PacketSharePermission, PacketStatus } from "@proofpilot/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { PacketShareEmailQueueService } from "../queue/packet-share-email-queue.service.js";
import { PacketShareAccessService } from "./packet-share-access.service.js";
import type { PacketShareMailerService } from "./packet-share-mailer.service.js";
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
    },
    packetShareAccessChallenge: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    packetShareEmailDelivery: {
      createMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    packetShareRecipient: {
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
    auditLog: {
      create: vi.fn().mockResolvedValue({})
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
    packetShareAccessChallenge: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
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

function createMailerMock() {
  return {
    deliveryMode: "DEVELOPMENT_LOG" as const,
    send: vi.fn().mockResolvedValue({ providerMessageId: null }),
    sendAccessCode: vi.fn().mockResolvedValue({ providerMessageId: null })
  };
}

function createQueueMock() {
  return {
    triggerDelivery: vi.fn().mockResolvedValue({ id: "queue-job-1" })
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;
type JwtMock = ReturnType<typeof createJwtMock>;
type MailerMock = ReturnType<typeof createMailerMock>;
type QueueMock = ReturnType<typeof createQueueMock>;

function createServices(
  prisma: PrismaMock,
  jwt: JwtMock,
  mailer: MailerMock,
  queue: QueueMock
) {
  process.env.DATABASE_URL = "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot";
  process.env.JWT_SECRET = "proofpilot-test-secret-with-32-chars";
  process.env.WEB_ORIGIN = "https://app.proofpilot.test";

  return {
    accessService: new PacketShareAccessService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      mailer as unknown as PacketShareMailerService
    ),
    service: new PacketSharingService(
      prisma as unknown as PrismaService,
      mailer as unknown as PacketShareMailerService,
      queue as unknown as PacketShareEmailQueueService
    )
  };
}

function createPacketExport() {
  return {
    byteSize: 2048,
    createdAt: new Date("2026-07-17T12:00:00.000Z"),
    id: packetExportId,
    packet: {
      id: "packet-1",
      case: {
        owner: { email: "owner@example.com", name: "Case Owner" },
        title: "Account appeal"
      }
    },
    storageKey: "users/owner-1/cases/case-1/packets/packet-1.pdf"
  };
}

function createStoredShare(
  recipients: Array<{
    email: string;
    id: string;
    lastAccessedAt: Date | null;
    permission: PacketSharePermission;
  }> = [
    {
      id: "recipient-1",
      email: "advisor@example.com",
      permission: PacketSharePermission.COMMENT,
      lastAccessedAt: null
    }
  ]
) {
  return {
    id: "share-1",
    createdAt: new Date("2026-07-18T12:00:00.000Z"),
    expiresAt: new Date("2026-07-25T12:00:00.000Z"),
    requireEmailVerification: false,
    watermarkDocuments: false,
    recipients
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
  let mailer: MailerMock;
  let queue: QueueMock;
  let accessService: PacketShareAccessService;
  let service: PacketSharingService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    prisma = createPrismaMock();
    jwt = createJwtMock();
    mailer = createMailerMock();
    queue = createQueueMock();
    ({ accessService, service } = createServices(prisma, jwt, mailer, queue));
    storageMocks.createPresignedDownloadUrl.mockImplementation(
      async (input: { disposition?: string }) => `https://storage.test/${input.disposition}`
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
        emailDelivery: true,
        emailDeliveryMode: "DEVELOPMENT_LOG",
        emailVerification: true,
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
    prisma.transactionClient.packetShare.create.mockResolvedValue(createStoredShare());

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
    expect(prisma.transactionClient.packetShareEmailDelivery.createMany).toHaveBeenCalledWith({
      data: [
        {
          nextAttemptAt: new Date("2026-07-18T12:00:00.000Z"),
          recipientId: "recipient-1",
          shareId: "share-1"
        }
      ]
    });
    expect(queue.triggerDelivery).toHaveBeenCalledOnce();
    expect(mailer.send).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      deliveryMode: "DEVELOPMENT_LOG",
      emailDelivery: {
        attemptedCount: 0,
        failedCount: 0,
        queuedCount: 1,
        successfulCount: 0
      }
    });
  });

  it("queues every recipient without waiting for provider delivery", async () => {
    const storedRecipients = [
      {
        id: "recipient-1",
        email: "advisor@example.com",
        permission: PacketSharePermission.VIEW,
        lastAccessedAt: null
      },
      {
        id: "recipient-2",
        email: "reviewer@example.com",
        permission: PacketSharePermission.DOWNLOAD,
        lastAccessedAt: null
      }
    ];
    prisma.packetExport.findFirst.mockResolvedValue(createPacketExport());
    prisma.transactionClient.packetShare.create.mockResolvedValue(
      createStoredShare(storedRecipients)
    );
    const result = await service.create(ownerId, caseId, {
      expiresAt: "2026-07-25T12:00:00.000Z",
      packetExportId,
      recipients: [
        { email: "advisor@example.com", permission: "VIEW" },
        { email: "reviewer@example.com", permission: "DOWNLOAD" }
      ],
      requireEmailVerification: false,
      watermarkDocuments: false
    });

    expect(result).toMatchObject({
      id: "share-1",
      emailDelivery: {
        attemptedCount: 0,
        failedCount: 0,
        queuedCount: 2,
        successfulCount: 0
      }
    });
    expect(prisma.transactionClient.packetShareEmailDelivery.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ recipientId: "recipient-1", shareId: "share-1" }),
        expect.objectContaining({ recipientId: "recipient-2", shareId: "share-1" })
      ]
    });
    expect(mailer.send).not.toHaveBeenCalled();
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

  it("stores email verification and rejects unavailable watermarking", async () => {
    prisma.packetExport.findFirst.mockResolvedValue(createPacketExport());
    prisma.transactionClient.packetShare.create.mockResolvedValue({
      ...createStoredShare(),
      requireEmailVerification: true
    });

    const share = await service.create(ownerId, caseId, {
      packetExportId,
      recipients: [{ email: "advisor@example.com", permission: "VIEW" }],
      requireEmailVerification: true,
      watermarkDocuments: false
    });

    expect(
      prisma.transactionClient.packetShare.create.mock.calls[0]?.[0]?.data
        .requireEmailVerification
    ).toBe(true);
    expect(share.requireEmailVerification).toBe(true);

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

    await expect(accessService.getPublicMetadata("raw-token")).rejects.toBeInstanceOf(
      GoneException
    );
  });

  it("issues scoped access only to an allowlisted recipient", async () => {
    prisma.packetShare.findUnique.mockResolvedValue(createPublicShare());

    await expect(
      accessService.requestAccess({ email: "unknown@example.com", token: "raw-token" })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const result = await accessService.requestAccess({
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
    expect(result).toMatchObject({
      access: { permission: "VIEW" },
      status: "ACCESS_GRANTED"
    });
  });

  it("requires and consumes a one-time code when verification is enabled", async () => {
    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.COMMENT, {
        requireEmailVerification: true
      })
    );
    prisma.packetShareAccessChallenge.findFirst.mockResolvedValue(null);

    const requested = await accessService.requestAccess({
      email: "advisor@example.com",
      token: "raw-token"
    });

    expect(requested.status).toBe("CODE_REQUIRED");
    if (requested.status !== "CODE_REQUIRED" || !requested.developmentCode) {
      throw new Error("Expected a development verification code.");
    }
    const challengeData =
      prisma.packetShareAccessChallenge.create.mock.calls[0]?.[0]?.data;
    expect(mailer.sendAccessCode).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: requested.challengeId,
        code: requested.developmentCode,
        packetTitle: "Account appeal",
        to: "advisor@example.com"
      })
    );

    prisma.packetShareAccessChallenge.findFirst.mockResolvedValue({
      attemptCount: 0,
      codeHash: challengeData.codeHash,
      consumedAt: null,
      expiresAt: new Date("2026-07-18T12:10:00.000Z")
    });

    const verified = await accessService.verifyAccess({
      challengeId: requested.challengeId,
      code: requested.developmentCode,
      email: "advisor@example.com",
      token: "raw-token"
    });

    expect(verified.permission).toBe("COMMENT");
    expect(
      prisma.transactionClient.packetShareAccessChallenge.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attemptCount: { increment: 1 },
          consumedAt: new Date("2026-07-18T12:00:00.000Z")
        })
      })
    );
    expect(prisma.transactionClient.packetShareRecipient.update).toHaveBeenCalledWith({
      data: { lastAccessedAt: new Date("2026-07-18T12:00:00.000Z") },
      where: { id: "recipient-1" }
    });
  });

  it("counts invalid verification attempts without issuing access", async () => {
    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.VIEW, {
        requireEmailVerification: true
      })
    );
    prisma.packetShareAccessChallenge.findFirst.mockResolvedValue({
      attemptCount: 1,
      codeHash: "not-the-code-hash",
      consumedAt: null,
      expiresAt: new Date("2026-07-18T12:10:00.000Z")
    });

    await expect(
      accessService.verifyAccess({
        challengeId: "challenge-1234",
        code: "123456",
        email: "advisor@example.com",
        token: "raw-token"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.packetShareAccessChallenge.updateMany).toHaveBeenCalledWith({
      data: { attemptCount: { increment: 1 } },
      where: {
        attemptCount: { lt: 5 },
        consumedAt: null,
        id: "challenge-1234"
      }
    });
    expect(jwt.signAsync).not.toHaveBeenCalled();
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

    const viewContent = await accessService.getContent("raw-token", "access-token");

    expect(viewContent.viewUrl).toBe("https://storage.test/inline");
    expect(viewContent.downloadUrl).toBeNull();

    prisma.packetShare.findUnique.mockResolvedValue(
      createPublicShare(PacketSharePermission.DOWNLOAD)
    );
    const downloadContent = await accessService.getContent("raw-token", "access-token");

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
      accessService.getContent("raw-token", "access-token")
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
      accessService.addComment("raw-token", "access-token", {
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

    const result = await accessService.addComment("raw-token", "access-token", {
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
