import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { getApiEnv } from "../config/env.js";

interface PasswordResetEmail {
  resetUrl: string;
  to: string;
}

@Injectable()
export class PasswordResetMailerService {
  private readonly config = getApiEnv();
  private readonly logger = new Logger(PasswordResetMailerService.name);
  private readonly resend = this.config.RESEND_API_KEY
    ? new Resend(this.config.RESEND_API_KEY)
    : null;

  async send({ resetUrl, to }: PasswordResetEmail) {
    if (this.config.PASSWORD_RESET_DELIVERY_MODE === "log") {
      this.logger.log(`Development password reset link for ${to}: ${resetUrl}`);
      return;
    }

    if (!this.resend || !this.config.AUTH_EMAIL_FROM) {
      throw new Error("Password reset email delivery is not configured.");
    }

    const { error } = await this.resend.emails.send({
      from: this.config.AUTH_EMAIL_FROM,
      to,
      subject: "Reset your ProofPilot password",
      text: [
        "A password reset was requested for your ProofPilot account.",
        "",
        `Reset your password: ${resetUrl}`,
        "",
        `This link expires in ${this.config.PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.`,
        "If you did not request this change, you can ignore this email."
      ].join("\n"),
      html: createPasswordResetHtml(
        resetUrl,
        this.config.PASSWORD_RESET_TOKEN_TTL_MINUTES
      )
    });

    if (error) {
      throw new Error(`Resend rejected the password reset email: ${error.message}`);
    }
  }
}

function createPasswordResetHtml(resetUrl: string, ttlMinutes: number) {
  const safeUrl = escapeHtml(resetUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0a0d10;color:#f8f6f2;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="margin:0 0 12px;color:#e58a45;font-size:13px;font-weight:700;text-transform:uppercase">ProofPilot security</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">Reset your password</h1>
      <p style="margin:0 0 24px;color:#c7c2bb;line-height:1.6">A password reset was requested for your account. This link expires in ${ttlMinutes} minutes.</p>
      <a href="${safeUrl}" style="display:inline-block;border-radius:8px;background:#df621f;color:#fff;padding:14px 20px;font-weight:700;text-decoration:none">Reset password</a>
      <p style="margin:28px 0 0;color:#8f8b85;font-size:13px;line-height:1.6">If you did not request this change, you can ignore this email.</p>
    </div>
  </body>
</html>`;
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
