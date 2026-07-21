import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import type { CaseCollaboratorRole } from "@proofpilot/types";
import { getApiEnv } from "../config/env.js";

interface CollaborationInvitationEmail {
  caseTitle: string;
  expiresAt: Date;
  invitationUrl: string;
  ownerName: string;
  role: CaseCollaboratorRole;
  to: string;
}

@Injectable()
export class CollaborationInvitationMailerService {
  private readonly config = getApiEnv();
  private readonly logger = new Logger(CollaborationInvitationMailerService.name);
  private readonly resend = this.config.RESEND_API_KEY
    ? new Resend(this.config.RESEND_API_KEY)
    : null;

  async send(input: CollaborationInvitationEmail) {
    if (this.config.PASSWORD_RESET_DELIVERY_MODE === "log") {
      this.logger.log(`Development collaboration invitation for ${input.to}: ${input.invitationUrl}`);
      return;
    }

    if (!this.resend || !this.config.AUTH_EMAIL_FROM) {
      throw new Error("Collaboration invitation email delivery is not configured.");
    }

    const roleLabel = input.role === "EDITOR" ? "Editor" : "Viewer";
    const expiryLabel = input.expiresAt.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
    const { error } = await this.resend.emails.send({
      from: this.config.AUTH_EMAIL_FROM,
      to: input.to,
      subject: `${input.ownerName} invited you to a ProofPilot case`,
      text: [
        `${input.ownerName} invited you to collaborate on ${input.caseTitle}.`,
        `Role: ${roleLabel}`,
        `Invitation expires: ${expiryLabel}`,
        "",
        `Review invitation: ${input.invitationUrl}`,
        "",
        "Only accept this invitation if you recognize the sender."
      ].join("\n"),
      html: createInvitationHtml({
        ...input,
        expiryLabel,
        roleLabel
      })
    });

    if (error) {
      throw new Error(`Resend rejected the collaboration invitation: ${error.message}`);
    }
  }
}

function createInvitationHtml(
  input: CollaborationInvitationEmail & { expiryLabel: string; roleLabel: string }
) {
  const invitationUrl = escapeHtml(input.invitationUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0a0d10;color:#f8f6f2;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="margin:0 0 12px;color:#e58a45;font-size:13px;font-weight:700;text-transform:uppercase">ProofPilot collaboration</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">You have been invited</h1>
      <p style="margin:0 0 12px;color:#c7c2bb;line-height:1.6">${escapeHtml(input.ownerName)} invited you to collaborate on <strong style="color:#f8f6f2">${escapeHtml(input.caseTitle)}</strong>.</p>
      <p style="margin:0 0 24px;color:#c7c2bb;line-height:1.6">Role: ${input.roleLabel}. Expires ${input.expiryLabel}.</p>
      <a href="${invitationUrl}" style="display:inline-block;border-radius:8px;background:#df621f;color:#fff;padding:14px 20px;font-weight:700;text-decoration:none">Review invitation</a>
      <p style="margin:28px 0 0;color:#8f8b85;font-size:13px;line-height:1.6">Only accept this invitation if you recognize the sender.</p>
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
