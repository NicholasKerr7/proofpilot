import type { PacketSharePermission } from "@proofpilot/types";
import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse
} from "resend";
import { getWorkerEnv } from "../config/env.js";

export interface PacketShareInvitationEmailInput {
  caseTitle: string;
  deliveryId: string;
  expiresAt: Date | null;
  ownerName: string;
  permission: PacketSharePermission;
  recipientId: string;
  requireEmailVerification: boolean;
  shareId: string;
  shareUrl: string;
  to: string;
}

export interface PacketShareInvitationEmailSender {
  send(
    input: PacketShareInvitationEmailInput
  ): Promise<{ providerMessageId: string | null }>;
}

export interface PacketShareInvitationEmailProvider {
  send(
    payload: CreateEmailOptions,
    options?: CreateEmailRequestOptions
  ): Promise<CreateEmailResponse>;
}

export function createPacketShareInvitationEmailSender(
  config = getWorkerEnv(),
  providerOverride?: PacketShareInvitationEmailProvider | null
): PacketShareInvitationEmailSender {
  const provider =
    providerOverride === undefined
      ? config.RESEND_API_KEY
        ? new Resend(config.RESEND_API_KEY).emails
        : null
      : providerOverride;

  return {
    async send(input) {
      if (config.PACKET_SHARE_EMAIL_DELIVERY_MODE === "log") {
        console.log("ProofPilot packet-share email accepted in log mode", {
          deliveryId: input.deliveryId,
          recipientId: input.recipientId,
          shareId: input.shareId
        });
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
          subject: normalizeSubject(
            `${input.ownerName} shared a ProofPilot packet`
          ),
          text: createPacketShareInvitationEmailText(input),
          html: createPacketShareInvitationEmailHtml(input)
        },
        { idempotencyKey: `proofpilot-packet-share-${input.deliveryId}` }
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

export function createPacketShareInvitationEmailHtml(
  input: PacketShareInvitationEmailInput
) {
  const expiration = getExpirationLabel(input.expiresAt);
  const permission = getPermissionLabel(input.permission);
  const verification = input.requireEmailVerification
    ? "A one-time code sent to this address is required before the packet opens."
    : "Confirm this invited email address before the packet opens.";
  const shareUrl = escapeHtml(input.shareUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0a0d10;color:#f8f6f2;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="margin:0 0 12px;color:#e58a45;font-size:13px;font-weight:700;text-transform:uppercase">ProofPilot secure packet</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">A case packet was shared with you</h1>
      <p style="margin:0 0 12px;color:#c7c2bb;line-height:1.6"><strong style="color:#f8f6f2">${escapeHtml(input.ownerName)}</strong> shared <strong style="color:#f8f6f2">${escapeHtml(input.caseTitle)}</strong>.</p>
      <p style="margin:0 0 12px;color:#c7c2bb;line-height:1.6">Access: ${permission}. ${expiration}</p>
      <p style="margin:0 0 24px;color:#c7c2bb;line-height:1.6">${verification}</p>
      <a href="${shareUrl}" style="display:inline-block;border-radius:8px;background:#df621f;color:#fff;padding:14px 20px;font-weight:700;text-decoration:none">Open secure packet</a>
      <p style="margin:28px 0 0;color:#8f8b85;font-size:13px;line-height:1.6">Open this link only if you recognize the sender. This recipient link is unique to your invitation.</p>
    </div>
  </body>
</html>`;
}

function createPacketShareInvitationEmailText(
  input: PacketShareInvitationEmailInput
) {
  return [
    `${input.ownerName} shared the ProofPilot case packet "${input.caseTitle}" with you.`,
    `Access: ${getPermissionLabel(input.permission)}.`,
    getExpirationLabel(input.expiresAt),
    input.requireEmailVerification
      ? "A one-time email code is required before the packet opens."
      : "Confirm your invited email address before the packet opens.",
    "",
    `Open secure packet: ${input.shareUrl}`,
    "",
    "Open this link only if you recognize the sender."
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

function createDeliveryError(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

function normalizeSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 160) || "ProofPilot packet shared";
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
