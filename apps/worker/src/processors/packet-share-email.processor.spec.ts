import {
  PacketShareEmailStatus,
  PacketSharePermission,
  type PrismaClient
} from "@proofpilot/database";
import { verifyPacketShareRecipientToken } from "@proofpilot/types/packet-share-security";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PacketShareInvitationEmailSender } from "./packet-share-email-sender.js";
import {
  deliverPacketShareEmailBatch,
  packetShareEmailLeaseMs,
  packetShareEmailRetryDelaysMs
} from "./packet-share-email.processor.js";

const now = new Date("2026-07-22T18:00:00.000Z");
const createdAt = new Date("2026-07-22T17:00:00.000Z");
const updatedAt = new Date("2026-07-22T17:30:00.000Z");
const signingSecret = "proofpilot-test-packet-signing-secret";

function createPrismaMock() {
  const transactionClient = {
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    packetShareEmailDelivery: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
  return {
    $transaction: vi.fn(
      async (callback: (transaction: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient)
    ),
    packetShareEmailDelivery: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    transactionClient
  };
}

function createSenderMock() {
  return {
    send: vi.fn().mockResolvedValue({ providerMessageId: "provider-email-1" })
  };
}

function createDelivery(overrides: Record<string, unknown> = {}) {
  return {
    attemptCount: 1,
    createdAt,
    id: "delivery-1",
    status: PacketShareEmailStatus.PENDING,
    updatedAt,
    recipient: {
      email: "advisor@example.com",
      id: "recipient-1",
      permission: PacketSharePermission.COMMENT
    },
    share: {
      caseId: "case-1",
      createdBy: {
        email: "owner@example.com",
        name: "Case Owner"
      },
      createdById: "owner-1",
      expiresAt: new Date("2026-07-29T18:00:00.000Z"),
      id: "share-12345678",
      packetExport: {
        packet: {
          case: { title: "Account appeal" }
        }
      },
      requireEmailVerification: true,
      revokedAt: null as Date | null
    },
    ...overrides
  };
}

function prepareDelivery(
  prisma: ReturnType<typeof createPrismaMock>,
  delivery: ReturnType<typeof createDelivery>
) {
  prisma.packetShareEmailDelivery.findMany.mockResolvedValue([
    {
      id: delivery.id,
      status: delivery.status,
      updatedAt: delivery.updatedAt
    }
  ]);
  prisma.packetShareEmailDelivery.findUnique.mockResolvedValue(delivery);
}

describe("deliverPacketShareEmailBatch", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let sender: ReturnType<typeof createSenderMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    sender = createSenderMock();
  });

  it("leases and sends a recipient-scoped invitation", async () => {
    const delivery = createDelivery();
    prepareDelivery(prisma, delivery);

    await expect(
      deliverPacketShareEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as PacketShareInvitationEmailSender,
        signingSecret,
        "https://app.proofpilot.test/"
      )
    ).resolves.toEqual({
      claimed: 1,
      contended: 0,
      examined: 1,
      exhausted: 0,
      failed: 0,
      sent: 1,
      suppressed: 0
    });

    const sendInput = sender.send.mock.calls[0]?.[0];
    const token = new URL(sendInput.shareUrl.replace("#", "?token=")).searchParams.get(
      "token"
    );
    expect(token).toBeTruthy();
    expect(
      verifyPacketShareRecipientToken(token ?? "", signingSecret)
    ).toEqual({
      recipientId: delivery.recipient.id,
      shareId: delivery.share.id
    });
    expect(sendInput).toMatchObject({
      deliveryId: delivery.id,
      requireEmailVerification: true,
      to: "advisor@example.com"
    });
    expect(
      prisma.transactionClient.packetShareEmailDelivery.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerMessageId: "provider-email-1",
          sentAt: now,
          status: PacketShareEmailStatus.SENT
        })
      })
    );
  });

  it("suppresses delivery after the share is revoked", async () => {
    const delivery = createDelivery({
      share: {
        ...createDelivery().share,
        revokedAt: new Date("2026-07-22T17:55:00.000Z")
      }
    });
    prepareDelivery(prisma, delivery);

    await expect(
      deliverPacketShareEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as PacketShareInvitationEmailSender,
        signingSecret,
        "https://app.proofpilot.test"
      )
    ).resolves.toMatchObject({ sent: 0, suppressed: 1 });

    expect(sender.send).not.toHaveBeenCalled();
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "case.packet_share_email_suppressed",
          metadata: expect.objectContaining({ reason: "share_revoked" })
        })
      })
    );
  });

  it("records a sanitized failure and schedules a retry", async () => {
    const delivery = createDelivery();
    prepareDelivery(prisma, delivery);
    sender.send.mockRejectedValue(
      Object.assign(new Error("private provider response"), {
        code: "rate limit/<private>"
      })
    );
    const retryAt = new Date(now.getTime() + packetShareEmailRetryDelaysMs[0]);

    await expect(
      deliverPacketShareEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as PacketShareInvitationEmailSender,
        signingSecret,
        "https://app.proofpilot.test"
      )
    ).resolves.toMatchObject({ exhausted: 0, failed: 1, sent: 0 });

    expect(
      prisma.transactionClient.packetShareEmailDelivery.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          lastErrorCode: "rate_limit__private_",
          nextAttemptAt: retryAt,
          status: PacketShareEmailStatus.FAILED
        }
      })
    );
    expect(JSON.stringify(prisma.transactionClient.auditLog.create.mock.calls)).not.toContain(
      "private provider response"
    );
  });

  it("does not send when another worker wins the claim", async () => {
    prisma.packetShareEmailDelivery.findMany.mockResolvedValue([
      createDelivery()
    ]);
    prisma.packetShareEmailDelivery.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      deliverPacketShareEmailBatch(
        prisma as unknown as PrismaClient,
        now,
        sender as unknown as PacketShareInvitationEmailSender,
        signingSecret,
        "https://app.proofpilot.test"
      )
    ).resolves.toMatchObject({ claimed: 0, contended: 1, sent: 0 });

    expect(sender.send).not.toHaveBeenCalled();
  });

  it("includes expired leases in the candidate query", async () => {
    prisma.packetShareEmailDelivery.findMany.mockResolvedValue([]);

    await deliverPacketShareEmailBatch(
      prisma as unknown as PrismaClient,
      now,
      sender as unknown as PacketShareInvitationEmailSender,
      signingSecret,
      "https://app.proofpilot.test"
    );

    expect(prisma.packetShareEmailDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              lastAttemptAt: {
                lte: new Date(now.getTime() - packetShareEmailLeaseMs)
              },
              status: PacketShareEmailStatus.SENDING
            }
          ])
        })
      })
    );
  });
});
