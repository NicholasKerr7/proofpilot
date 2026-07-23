import { Injectable, Logger } from "@nestjs/common";
import type { PacketShareEmailDeliveryMode, PacketSharePermission } from "@proofpilot/types";
import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse
} from "resend";
import { getApiEnv } from "../config/env.js";

export interface PacketShareEmailInput {
  caseTitle: string;
  expiresAt: Date | null;
  ownerName: string;
  permission: PacketSharePermission;
  recipientId: string;
  shareId: string;
  shareUrl: string;
  to: string;
}

export interface PacketShareEmailSendResult {
  providerMessageId: string | null;
}

export interface PacketShareEmailSender {
  deliveryMode: PacketShareEmailDeliveryMode;
  send(input: PacketShareEmailInput): Promise<PacketShareEmailSendResult>;
}

export interface PacketShareEmailProvider {
  send(
    payload: CreateEmailOptions,
    options?: CreateEmailRequestOptions
  ): Promise<CreateEmailResponse>;
}

@Injectable()
export class PacketShareMailerService {
  private readonly sender = createPacketShareEmailSender();

  get deliveryMode() {
    return this.sender.deliveryMode;
  }

  send(input: PacketShareEmailInput) {
    return this.sender.send(input);
  }
}

export function createPacketShareEmailSender(
  config = getApiEnv(),
  providerOverride?: PacketShareEmailProvider | null,
  logger: Pick<Logger, "log"> = new Logger(PacketShareMailerService.name)
): PacketShareEmailSender {
  const deliveryMode: PacketShareEmailDeliveryMode =
    config.PACKET_SHARE_EMAIL_DELIVERY_MODE === "resend"
      ? "RESEND"
      : "DEVELOPMENT_LOG";
  const provider =
    providerOverride === undefined
      ? config.RESEND_API_KEY
        ? new Resend(config.RESEND_API_KEY).emails
        : null
      : providerOverride;

  return {
    deliveryMode,
    async send(input) {
      if (deliveryMode === "DEVELOPMENT_LOG") {
        logger.log(
          JSON.stringify({
            event: "packet_share_email_simulated",
            recipientId: input.recipientId,
            shareId: input.shareId
          })
        );
        return { providerMessageId: null };
      }

      if (!provider || !config.AUTH_EMAIL_FROM) {
        throw createDeliveryError(
          "Packet-share email delivery is not configured.",
          "EMAIL_NOT_CONFIGURED"
        );
      }

      const { data, error } = await provider.send(
        {
          from: config.AUTH_EMAIL_FROM,
          to: input.to,
          subject: normalizeSubject(`${input.ownerName} shared a ProofPilot packet`),
          text: createPacketShareEmailText(input),
          html: createPacketShareEmailHtml(input)
        },
        {
          idempotencyKey: `proofpilot-packet-share-${input.shareId}-${input.recipientId}`
        }
      );

      if (error) {
        throw createDeliveryError(
          "Packet-share email delivery was rejected.",
          error.name
        );
      }

      if (!data?.id) {
        throw createDeliveryError(
          "Packet-share email provider returned an invalid response.",
          "EMAIL_PROVIDER_NO_ID"
        );
      }

      return { providerMessageId: data.id };
    }
  };
}

export function createPacketShareEmailHtml(input: PacketShareEmailInput) {
  const expiration = getExpirationLabel(input.expiresAt);
  const permission = getPermissionLabel(input.permission);
  const shareUrl = escapeHtml(input.shareUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0a0d10;color:#f8f6f2;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="margin:0 0 12px;color:#e58a45;font-size:13px;font-weight:700;text-transform:uppercase">ProofPilot secure packet</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">A case packet was shared with you</h1>
      <p style="margin:0 0 12px;color:#c7c2bb;line-height:1.6"><strong style="color:#f8f6f2">${escapeHtml(input.ownerName)}</strong> shared <strong style="color:#f8f6f2">${escapeHtml(input.caseTitle)}</strong>.</p>
      <p style="margin:0 0 24px;color:#c7c2bb;line-height:1.6">Access: ${permission}. ${expiration}</p>
      <a href="${shareUrl}" style="display:inline-block;border-radius:8px;background:#df621f;color:#fff;padding:14px 20px;font-weight:700;text-decoration:none">Open secure packet</a>
      <p style="margin:28px 0 0;color:#8f8b85;font-size:13px;line-height:1.6">Open this link only if you recognize the sender. Your invited email address is required for access.</p>
    </div>
  </body>
</html>`;
}

function createPacketShareEmailText(input: PacketShareEmailInput) {
  return [
    `${input.ownerName} shared the ProofPilot case packet "${input.caseTitle}" with you.`,
    `Access: ${getPermissionLabel(input.permission)}.`,
    getExpirationLabel(input.expiresAt),
    "",
    `Open secure packet: ${input.shareUrl}`,
    "",
    "Open this link only if you recognize the sender.",
    "Your invited email address is required for access."
  ].join("\n");
}

function getExpirationLabel(expiresAt: Date | null) {
  if (!expiresAt) {
    return "The link does not expire automatically.";
  }

  const date = expiresAt.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  });

  return `The link expires ${date}.`;
}

function getPermissionLabel(permission: PacketSharePermission) {
  switch (permission) {
    case "COMMENT":
      return "View and comment";
    case "DOWNLOAD":
      return "View and download";
    default:
      return "View only";
  }
}

function normalizeSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 160) || "ProofPilot packet shared";
}

function createDeliveryError(message: string, code: string) {
  return Object.assign(new Error(message), { code });
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
