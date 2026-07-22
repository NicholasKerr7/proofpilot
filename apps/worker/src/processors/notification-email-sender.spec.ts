import { afterEach, describe, expect, it, vi } from "vitest";
import { getWorkerEnv } from "../config/env.js";
import {
  createNotificationEmailHtml,
  createNotificationEmailSender,
  type NotificationEmailProvider
} from "./notification-email-sender.js";

const baseEnv = {
  DATABASE_URL: "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot"
};

function createEmailInput() {
  return {
    body: "Your packet is ready.",
    notificationId: "notification-1",
    recipientName: "Nicholas Kerr",
    title: "Packet\nready",
    to: "nicholas.kerr@proofpilot.test",
    type: "packet_ready"
  };
}

describe("createNotificationEmailHtml", () => {
  it("escapes notification content and action URLs", () => {
    const html = createNotificationEmailHtml(
      {
        body: "Case <script>alert('unsafe')</script>",
        recipientName: 'Nicholas & "Team"',
        title: "Packet <ready>"
      },
      "https://proofpilot.test/?next=<unsafe>"
    );

    expect(html).toContain("Nicholas &amp; &quot;Team&quot;");
    expect(html).toContain("Packet &lt;ready&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#039;unsafe&#039;)&lt;/script&gt;");
    expect(html).toContain("next=&lt;unsafe&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("createNotificationEmailSender", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a stable idempotency key and returns the provider message ID", async () => {
    const provider = {
      send: vi.fn().mockResolvedValue({
        data: { id: "provider-email-1" },
        error: null,
        headers: null
      })
    };
    const sender = createNotificationEmailSender(
      getWorkerEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <updates@proofpilot.test>",
        NOTIFICATION_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      }),
      provider as NotificationEmailProvider
    );

    await expect(sender.send(createEmailInput())).resolves.toEqual({
      providerMessageId: "provider-email-1"
    });
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "ProofPilot <updates@proofpilot.test>",
        subject: "[ProofPilot] Packet ready",
        to: "nicholas.kerr@proofpilot.test"
      }),
      { idempotencyKey: "proofpilot-notification-notification-1" }
    );
  });

  it("converts provider rejections into coded delivery errors", async () => {
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
    const sender = createNotificationEmailSender(
      getWorkerEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <updates@proofpilot.test>",
        NOTIFICATION_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      }),
      provider as NotificationEmailProvider
    );

    await expect(sender.send(createEmailInput())).rejects.toMatchObject({
      code: "rate_limit_exceeded",
      message: "Notification email delivery was rejected."
    });
  });

  it("does not log recipient addresses or notification content in log mode", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const sender = createNotificationEmailSender(getWorkerEnv(baseEnv), null);

    await expect(sender.send(createEmailInput())).resolves.toEqual({
      providerMessageId: null
    });

    expect(log).toHaveBeenCalledWith(
      "ProofPilot notification email accepted in log mode",
      {
        notificationId: "notification-1",
        type: "packet_ready"
      }
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("nicholas.kerr");
    expect(JSON.stringify(log.mock.calls)).not.toContain("Your packet");
  });
});
