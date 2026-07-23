import { Injectable, Logger } from "@nestjs/common";
import type { PacketShareEmailDeliveryMode } from "@proofpilot/types";
import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse
} from "resend";
import { getApiEnv } from "../config/env.js";

export interface PacketShareAccessCodeEmailInput {
  challengeId: string;
  code: string;
  expiresAt: Date;
  packetTitle: string;
  to: string;
}

export interface PacketShareAccessCodeEmailSender {
  deliveryMode: PacketShareEmailDeliveryMode;
  sendAccessCode(
    input: PacketShareAccessCodeEmailInput
  ): Promise<{ providerMessageId: string | null }>;
}

export interface PacketShareEmailProvider {
  send(
    payload: CreateEmailOptions,
    options?: CreateEmailRequestOptions
  ): Promise<CreateEmailResponse>;
}

@Injectable()
export class PacketShareMailerService {
  private readonly sender = createPacketShareAccessCodeEmailSender();

  get deliveryMode() {
    return this.sender.deliveryMode;
  }

  sendAccessCode(input: PacketShareAccessCodeEmailInput) {
    return this.sender.sendAccessCode(input);
  }
}

export function createPacketShareAccessCodeEmailSender(
  config = getApiEnv(),
  providerOverride?: PacketShareEmailProvider | null,
  logger: Pick<Logger, "log"> = new Logger(PacketShareMailerService.name)
): PacketShareAccessCodeEmailSender {
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
    async sendAccessCode(input) {
      if (deliveryMode === "DEVELOPMENT_LOG") {
        logger.log(
          JSON.stringify({
            challengeId: input.challengeId,
            event: "packet_share_access_code_simulated"
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
          subject: "Your ProofPilot packet access code",
          text: createPacketShareAccessCodeEmailText(input),
          html: createPacketShareAccessCodeEmailHtml(input)
        },
        {
          idempotencyKey: `proofpilot-packet-access-${input.challengeId}`
        }
      );

      if (error) {
        throw createDeliveryError(
          "Packet access code delivery was rejected.",
          error.name
        );
      }

      if (!data?.id) {
        throw createDeliveryError(
          "Packet access code provider returned an invalid response.",
          "EMAIL_PROVIDER_NO_ID"
        );
      }

      return { providerMessageId: data.id };
    }
  };
}

export function createPacketShareAccessCodeEmailHtml(
  input: PacketShareAccessCodeEmailInput
) {
  const expiration = input.expiresAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  });

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0a0d10;color:#f8f6f2;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="margin:0 0 12px;color:#e58a45;font-size:13px;font-weight:700;text-transform:uppercase">ProofPilot recipient verification</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">Confirm your packet access</h1>
      <p style="margin:0 0 20px;color:#c7c2bb;line-height:1.6">Use this one-time code to open <strong style="color:#f8f6f2">${escapeHtml(input.packetTitle)}</strong>.</p>
      <p style="margin:0 0 20px;border:1px solid #6f3f24;border-radius:8px;background:#17110e;padding:18px 20px;color:#fff;font-family:monospace;font-size:30px;font-weight:700;text-align:center">${input.code}</p>
      <p style="margin:0;color:#8f8b85;font-size:13px;line-height:1.6">This code expires at ${expiration}. If you did not request access, you can ignore this email.</p>
    </div>
  </body>
</html>`;
}

function createPacketShareAccessCodeEmailText(
  input: PacketShareAccessCodeEmailInput
) {
  return [
    `Use this one-time code to open the ProofPilot packet "${input.packetTitle}":`,
    "",
    input.code,
    "",
    "The code expires in 10 minutes. If you did not request access, ignore this email."
  ].join("\n");
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
