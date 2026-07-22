import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse
} from "resend";
import { getWorkerEnv } from "../config/env.js";

export interface NotificationEmailInput {
  body: string;
  notificationId: string;
  recipientName: string;
  title: string;
  to: string;
  type: string;
}

export interface NotificationEmailSendResult {
  providerMessageId: string | null;
}

export interface NotificationEmailSender {
  send(input: NotificationEmailInput): Promise<NotificationEmailSendResult>;
}

export interface NotificationEmailProvider {
  send(
    payload: CreateEmailOptions,
    options?: CreateEmailRequestOptions
  ): Promise<CreateEmailResponse>;
}

export function createNotificationEmailSender(
  config = getWorkerEnv(),
  providerOverride?: NotificationEmailProvider | null
): NotificationEmailSender {
  const provider =
    providerOverride === undefined
      ? config.RESEND_API_KEY
        ? new Resend(config.RESEND_API_KEY).emails
        : null
      : providerOverride;

  return {
    async send(input) {
      if (config.NOTIFICATION_EMAIL_DELIVERY_MODE === "log") {
        console.log("ProofPilot notification email accepted in log mode", {
          notificationId: input.notificationId,
          type: input.type
        });
        return { providerMessageId: null };
      }

      if (!provider || !config.AUTH_EMAIL_FROM) {
        throw createDeliveryError(
          "Notification email delivery is not configured.",
          "EMAIL_NOT_CONFIGURED"
        );
      }

      const appUrl = new URL("/", config.WEB_ORIGIN).toString();
      const { data, error } = await provider.send(
        {
          from: config.AUTH_EMAIL_FROM,
          to: input.to,
          subject: `[ProofPilot] ${normalizeSubject(input.title)}`,
          text: createNotificationEmailText(input, appUrl),
          html: createNotificationEmailHtml(input, appUrl)
        },
        { idempotencyKey: `proofpilot-notification-${input.notificationId}` }
      );

      if (error) {
        throw createDeliveryError(
          "Notification email delivery was rejected.",
          error.name
        );
      }

      if (!data?.id) {
        throw createDeliveryError(
          "Notification email provider returned an invalid response.",
          "EMAIL_PROVIDER_NO_ID"
        );
      }

      return { providerMessageId: data.id };
    }
  };
}

export function createNotificationEmailHtml(
  input: Pick<NotificationEmailInput, "body" | "recipientName" | "title">,
  appUrl: string
) {
  const safeAppUrl = escapeHtml(appUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0a0d10;color:#f8f6f2;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="margin:0 0 12px;color:#e58a45;font-size:13px;font-weight:700;text-transform:uppercase">ProofPilot update</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${escapeHtml(input.title)}</h1>
      <p style="margin:0 0 12px;color:#c7c2bb;line-height:1.6">Hello ${escapeHtml(input.recipientName)},</p>
      <p style="margin:0 0 24px;color:#c7c2bb;line-height:1.6">${escapeHtml(input.body)}</p>
      <a href="${safeAppUrl}" style="display:inline-block;border-radius:8px;background:#df621f;color:#fff;padding:14px 20px;font-weight:700;text-decoration:none">Open ProofPilot</a>
      <p style="margin:28px 0 0;color:#8f8b85;font-size:13px;line-height:1.6">You can change notification delivery in ProofPilot settings.</p>
    </div>
  </body>
</html>`;
}

function createNotificationEmailText(
  input: Pick<NotificationEmailInput, "body" | "recipientName" | "title">,
  appUrl: string
) {
  return [
    `Hello ${input.recipientName},`,
    "",
    input.title,
    input.body,
    "",
    `Open ProofPilot: ${appUrl}`,
    "",
    "You can change notification delivery in ProofPilot settings."
  ].join("\n");
}

function createDeliveryError(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

function normalizeSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 140) || "ProofPilot update";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character] ?? character;
  });
}
