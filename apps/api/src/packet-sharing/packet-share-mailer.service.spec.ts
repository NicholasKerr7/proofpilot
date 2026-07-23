import { describe, expect, it, vi } from "vitest";
import { getApiEnv } from "../config/env.js";
import {
  createPacketShareEmailHtml,
  createPacketShareEmailSender,
  type PacketShareEmailProvider
} from "./packet-share-mailer.service.js";

const baseEnv = {
  DATABASE_URL: "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot",
  JWT_SECRET: "a-secure-test-secret-with-length"
};

function createEmailInput() {
  return {
    caseTitle: "Account <appeal>",
    expiresAt: new Date("2026-08-01T12:00:00.000Z"),
    ownerName: "Nicholas & Team",
    permission: "COMMENT" as const,
    recipientId: "recipient-1",
    shareId: "share-1",
    shareUrl: "https://app.proofpilot.test/shared-packet#secret<&token",
    to: "advisor@example.com"
  };
}

describe("createPacketShareEmailHtml", () => {
  it("escapes user content and the fragment-token URL", () => {
    const html = createPacketShareEmailHtml(createEmailInput());

    expect(html).toContain("Nicholas &amp; Team");
    expect(html).toContain("Account &lt;appeal&gt;");
    expect(html).toContain("#secret&lt;&amp;token");
    expect(html).not.toContain("Account <appeal>");
  });
});

describe("createPacketShareEmailSender", () => {
  it("uses a recipient-specific idempotency key in Resend mode", async () => {
    const provider = {
      send: vi.fn().mockResolvedValue({
        data: { id: "provider-email-1" },
        error: null,
        headers: null
      })
    };
    const sender = createPacketShareEmailSender(
      getApiEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <shares@proofpilot.test>",
        PACKET_SHARE_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      }),
      provider as PacketShareEmailProvider
    );

    await expect(sender.send(createEmailInput())).resolves.toEqual({
      providerMessageId: "provider-email-1"
    });
    expect(sender.deliveryMode).toBe("RESEND");
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Nicholas & Team shared a ProofPilot packet",
        to: "advisor@example.com"
      }),
      { idempotencyKey: "proofpilot-packet-share-share-1-recipient-1" }
    );
  });

  it("returns sanitized coded errors for provider rejections", async () => {
    const provider = {
      send: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "sensitive provider response",
          name: "rate_limit_exceeded",
          statusCode: 429
        },
        headers: null
      })
    };
    const sender = createPacketShareEmailSender(
      getApiEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <shares@proofpilot.test>",
        PACKET_SHARE_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      }),
      provider as PacketShareEmailProvider
    );

    await expect(sender.send(createEmailInput())).rejects.toMatchObject({
      code: "rate_limit_exceeded",
      message: "Packet-share email delivery was rejected."
    });
  });

  it("simulates delivery without logging recipients, content, or tokens", async () => {
    const logger = { log: vi.fn() };
    const sender = createPacketShareEmailSender(
      getApiEnv(baseEnv),
      null,
      logger
    );

    await expect(sender.send(createEmailInput())).resolves.toEqual({
      providerMessageId: null
    });
    expect(sender.deliveryMode).toBe("DEVELOPMENT_LOG");
    expect(logger.log).toHaveBeenCalledWith(
      JSON.stringify({
        event: "packet_share_email_simulated",
        recipientId: "recipient-1",
        shareId: "share-1"
      })
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("advisor@example.com");
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain("Account");
  });
});
