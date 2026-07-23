import { describe, expect, it, vi } from "vitest";
import { getApiEnv } from "../config/env.js";
import {
  createPacketShareAccessCodeEmailHtml,
  createPacketShareAccessCodeEmailSender,
  type PacketShareEmailProvider
} from "./packet-share-mailer.service.js";

const baseEnv = {
  DATABASE_URL: "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot",
  JWT_SECRET: "a-secure-test-secret-with-length"
};

function createEmailInput() {
  return {
    challengeId: "challenge-12345678",
    code: "482901",
    expiresAt: new Date("2026-08-01T12:10:00.000Z"),
    packetTitle: "Account <appeal>",
    to: "advisor@example.com"
  };
}

describe("createPacketShareAccessCodeEmailHtml", () => {
  it("escapes packet titles and renders the one-time code", () => {
    const html = createPacketShareAccessCodeEmailHtml(createEmailInput());

    expect(html).toContain("Account &lt;appeal&gt;");
    expect(html).toContain("482901");
    expect(html).not.toContain("Account <appeal>");
  });
});

describe("createPacketShareAccessCodeEmailSender", () => {
  it("uses a challenge-specific idempotency key in Resend mode", async () => {
    const provider = {
      send: vi.fn().mockResolvedValue({
        data: { id: "provider-email-1" },
        error: null,
        headers: null
      })
    };
    const sender = createPacketShareAccessCodeEmailSender(
      getApiEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <shares@proofpilot.test>",
        PACKET_SHARE_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      }),
      provider as PacketShareEmailProvider
    );

    await expect(sender.sendAccessCode(createEmailInput())).resolves.toEqual({
      providerMessageId: "provider-email-1"
    });
    expect(sender.deliveryMode).toBe("RESEND");
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your ProofPilot packet access code",
        to: "advisor@example.com"
      }),
      { idempotencyKey: "proofpilot-packet-access-challenge-12345678" }
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
    const sender = createPacketShareAccessCodeEmailSender(
      getApiEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <shares@proofpilot.test>",
        PACKET_SHARE_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      }),
      provider as PacketShareEmailProvider
    );

    await expect(sender.sendAccessCode(createEmailInput())).rejects.toMatchObject({
      code: "rate_limit_exceeded",
      message: "Packet access code delivery was rejected."
    });
  });

  it("does not log recipient addresses, packet titles, or codes", async () => {
    const logger = { log: vi.fn() };
    const sender = createPacketShareAccessCodeEmailSender(
      getApiEnv(baseEnv),
      null,
      logger
    );

    await expect(sender.sendAccessCode(createEmailInput())).resolves.toEqual({
      providerMessageId: null
    });
    expect(sender.deliveryMode).toBe("DEVELOPMENT_LOG");
    expect(logger.log).toHaveBeenCalledWith(
      JSON.stringify({
        challengeId: "challenge-12345678",
        event: "packet_share_access_code_simulated"
      })
    );
    const output = JSON.stringify(logger.log.mock.calls);
    expect(output).not.toContain("advisor@example.com");
    expect(output).not.toContain("482901");
    expect(output).not.toContain("Account");
  });
});
