import { describe, expect, it, vi } from "vitest";
import { getWorkerEnv } from "../config/env.js";
import {
  createPacketShareInvitationEmailHtml,
  createPacketShareInvitationEmailSender,
  type PacketShareInvitationEmailProvider
} from "./packet-share-email-sender.js";

const baseEnv = {
  DATABASE_URL: "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot",
  JWT_SECRET: "proofpilot-test-worker-secret-value",
  REDIS_URL: "redis://localhost:6379"
};

function createInput() {
  return {
    caseTitle: "Account <appeal>",
    deliveryId: "delivery-1",
    expiresAt: new Date("2026-08-01T12:00:00.000Z"),
    ownerName: "Nicholas & Team",
    permission: "COMMENT" as const,
    recipientId: "recipient-1",
    requireEmailVerification: true,
    shareId: "share-1",
    shareUrl: "https://app.proofpilot.test/shared-packet#signed<&token",
    to: "advisor@example.com"
  };
}

describe("packet share invitation email", () => {
  it("escapes user content and recipient-link URLs", () => {
    const html = createPacketShareInvitationEmailHtml(createInput());

    expect(html).toContain("Nicholas &amp; Team");
    expect(html).toContain("Account &lt;appeal&gt;");
    expect(html).toContain("#signed&lt;&amp;token");
    expect(html).toContain("one-time code");
  });

  it("uses the outbox delivery ID as the provider idempotency key", async () => {
    const provider = {
      send: vi.fn().mockResolvedValue({
        data: { id: "provider-email-1" },
        error: null,
        headers: null
      })
    };
    const sender = createPacketShareInvitationEmailSender(
      getWorkerEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <shares@proofpilot.test>",
        PACKET_SHARE_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      }),
      provider as PacketShareInvitationEmailProvider
    );

    await expect(sender.send(createInput())).resolves.toEqual({
      providerMessageId: "provider-email-1"
    });
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "advisor@example.com" }),
      { idempotencyKey: "proofpilot-packet-share-delivery-1" }
    );
  });

  it("does not log recipient addresses, packet content, or signed links", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const sender = createPacketShareInvitationEmailSender(
      getWorkerEnv(baseEnv),
      null
    );

    await sender.send(createInput());

    const output = JSON.stringify(log.mock.calls);
    expect(output).toContain("delivery-1");
    expect(output).not.toContain("advisor@example.com");
    expect(output).not.toContain("signed");
    expect(output).not.toContain("Account");
    log.mockRestore();
  });
});
