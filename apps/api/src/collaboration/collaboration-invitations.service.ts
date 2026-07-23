import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { CaseCollaboratorStatus as DatabaseCollaboratorStatus } from "@proofpilot/database";
import type {
  CaseCollaborationResponse,
  CaseCollaboratorRole,
  CaseInvitationDecisionResponse,
  CaseInvitationPreview
} from "@proofpilot/types";
import { randomBytes } from "node:crypto";
import { getApiEnv } from "../config/env.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { CollaborationInvitationMailerService } from "./collaboration-invitation-mailer.service.js";
import {
  addInvitationDays,
  collaboratorSeatLimit,
  type CollaborationStore,
  getInvitationExpiryDays,
  hashInvitationToken,
  isExpiredCollaborator
} from "./collaboration-store.js";
import type { InviteCaseCollaboratorDto } from "./dto/invite-case-collaborator.dto.js";

/** Owns invitation issuance, preview, acceptance, decline, and email delivery. */
export class CollaborationInvitationsService {
  private readonly config = getApiEnv();
  private readonly logger = new Logger(CollaborationInvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationMailer: CollaborationInvitationMailerService,
    private readonly store: CollaborationStore
  ) {}

  /** Returns the public invitation context without exposing the raw case record. */
  async getPreview(token: string): Promise<CaseInvitationPreview> {
    const invitation = await this.loadInvitation(token);
    const expired = Boolean(invitation.expiresAt && invitation.expiresAt <= new Date());

    return {
      caseTitle: invitation.case.title,
      expiresAt: invitation.expiresAt?.toISOString() ?? invitation.invitedAt.toISOString(),
      invitedEmail: invitation.email,
      ownerName: invitation.case.owner.name ?? invitation.case.owner.email,
      role: invitation.role as CaseCollaboratorRole,
      status: expired ? "EXPIRED" : "PENDING"
    };
  }

  /** Atomically claims a pending invitation for the matching signed-in account. */
  async accept(
    userId: string,
    token: string
  ): Promise<CaseInvitationDecisionResponse> {
    const invitation = await this.loadInvitation(token);
    const user = await this.loadInvitationUser(userId, invitation.email);
    const now = new Date();

    if (!invitation.expiresAt || invitation.expiresAt <= now) {
      throw new BadRequestException("This collaboration invitation has expired.");
    }

    await this.prisma.$transaction(async (tx) => {
      const accepted = await tx.caseCollaborator.updateMany({
        where: {
          id: invitation.id,
          inviteTokenHash: hashInvitationToken(token),
          status: DatabaseCollaboratorStatus.PENDING,
          expiresAt: { gt: now }
        },
        data: {
          acceptedAt: now,
          expiresAt: null,
          inviteTokenHash: null,
          name: user.name,
          status: DatabaseCollaboratorStatus.ACTIVE,
          userId
        }
      });

      if (accepted.count !== 1) {
        throw new BadRequestException(
          "This collaboration invitation is no longer available."
        );
      }

      await tx.auditLog.create({
        data: {
          userId,
          caseId: invitation.caseId,
          action: "case.collaboration_accepted",
          metadata: {
            collaboratorId: invitation.id,
            role: invitation.role
          }
        }
      });
      await tx.notification.create({
        data: {
          userId: invitation.case.ownerId,
          caseId: invitation.caseId,
          type: "collaboration_invitation_accepted",
          title: "Collaboration invitation accepted",
          body: `${user.name ?? user.email} joined ${invitation.case.title}.`
        }
      });
    });

    return {
      caseId: invitation.caseId,
      caseTitle: invitation.case.title,
      message: `You now have ${
        invitation.role === "EDITOR" ? "editor" : "viewer"
      } access to this case.`,
      ok: true,
      role: invitation.role as CaseCollaboratorRole
    };
  }

  /** Atomically consumes and removes a declined pending invitation. */
  async decline(
    userId: string,
    token: string
  ): Promise<CaseInvitationDecisionResponse> {
    const invitation = await this.loadInvitation(token);
    const user = await this.loadInvitationUser(userId, invitation.email);
    const now = new Date();

    if (!invitation.expiresAt || invitation.expiresAt <= now) {
      throw new BadRequestException("This collaboration invitation has expired.");
    }

    await this.prisma.$transaction(async (tx) => {
      const declined = await tx.caseCollaborator.deleteMany({
        where: {
          id: invitation.id,
          inviteTokenHash: hashInvitationToken(token),
          status: DatabaseCollaboratorStatus.PENDING,
          expiresAt: { gt: now }
        }
      });

      if (declined.count !== 1) {
        throw new BadRequestException(
          "This collaboration invitation is no longer available."
        );
      }

      await tx.auditLog.create({
        data: {
          userId,
          caseId: invitation.caseId,
          action: "case.collaboration_declined",
          metadata: {
            collaboratorId: invitation.id,
            role: invitation.role
          }
        }
      });
      await tx.notification.create({
        data: {
          userId: invitation.case.ownerId,
          caseId: invitation.caseId,
          type: "collaboration_invitation_declined",
          title: "Collaboration invitation declined",
          body: `${user.name ?? user.email} declined access to ${invitation.case.title}.`
        }
      });
    });

    return {
      caseId: null,
      caseTitle: invitation.case.title,
      message: "The collaboration invitation was declined.",
      ok: true,
      role: invitation.role as CaseCollaboratorRole
    };
  }

  /** Creates or renews an invitation and revokes it if delivery fails. */
  async invite(
    ownerId: string,
    caseId: string,
    input: InviteCaseCollaboratorDto
  ): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.store.loadOwnedCase(ownerId, caseId);
    const email = input.email.trim().toLowerCase();

    if (email === collaborationCase.owner.email.toLowerCase()) {
      throw new BadRequestException(
        "The case owner cannot be invited as a collaborator."
      );
    }

    const now = new Date();
    const existing = collaborationCase.collaborators.find(
      (collaborator) => collaborator.email === email
    );

    if (existing?.status === DatabaseCollaboratorStatus.ACTIVE) {
      throw new BadRequestException(
        "This person already collaborates on the case."
      );
    }

    const occupiedSeats = collaborationCase.collaborators.filter(
      (collaborator) => !isExpiredCollaborator(collaborator, now)
    ).length;
    const invitationAddsSeat =
      !existing || isExpiredCollaborator(existing, now);

    if (invitationAddsSeat && occupiedSeats >= collaboratorSeatLimit - 1) {
      throw new BadRequestException(
        "This case has reached its collaborator seat limit."
      );
    }

    const expiryDays = getInvitationExpiryDays(
      collaborationCase.sharingSettings?.invitationExpiryDays
    );
    const expiresAt = addInvitationDays(now, expiryDays);
    const rawToken = randomBytes(32).toString("base64url");
    const inviteTokenHash = hashInvitationToken(rawToken);

    const collaboratorId = await this.prisma.$transaction(async (tx) => {
      const collaborator = existing
        ? await tx.caseCollaborator.update({
            where: { id: existing.id },
            data: {
              acceptedAt: null,
              expiresAt,
              inviteTokenHash,
              invitedAt: now,
              name: null,
              role: input.role,
              status: DatabaseCollaboratorStatus.PENDING,
              userId: null
            },
            select: { id: true }
          })
        : await tx.caseCollaborator.create({
            data: {
              caseId,
              email,
              expiresAt,
              inviteTokenHash,
              invitedAt: now,
              name: null,
              role: input.role,
              status: DatabaseCollaboratorStatus.PENDING,
              userId: null
            },
            select: { id: true }
          });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.collaboration_invited",
          metadata: {
            collaboratorId: collaborator.id,
            renewed: Boolean(existing),
            role: input.role
          }
        }
      });

      return collaborator.id;
    });

    const invitationUrl = new URL("/", this.config.WEB_ORIGIN);
    invitationUrl.searchParams.set("inviteToken", rawToken);

    try {
      await this.invitationMailer.send({
        caseTitle: collaborationCase.title,
        expiresAt,
        invitationUrl: invitationUrl.toString(),
        ownerName:
          collaborationCase.owner.name ?? collaborationCase.owner.email,
        role: input.role,
        to: email
      });
    } catch (error) {
      // An undelivered token is expired immediately so it cannot consume a live seat.
      await this.prisma.caseCollaborator.updateMany({
        where: { id: collaboratorId, inviteTokenHash },
        data: { expiresAt: new Date(), inviteTokenHash: null }
      });
      this.logger.error(
        "Collaboration invitation delivery failed.",
        error instanceof Error ? error.stack : undefined
      );
      throw new ServiceUnavailableException(
        "The invitation could not be delivered. Retry sending it shortly."
      );
    }

    return this.store.get(ownerId, caseId);
  }

  /** Loads a pending invitation by hashed token while hiding invalid case state. */
  private async loadInvitation(token: string) {
    const invitation = await this.prisma.caseCollaborator.findUnique({
      where: { inviteTokenHash: hashInvitationToken(token) },
      select: {
        caseId: true,
        email: true,
        expiresAt: true,
        id: true,
        invitedAt: true,
        role: true,
        status: true,
        case: {
          select: {
            archivedAt: true,
            ownerId: true,
            title: true,
            owner: {
              select: {
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (
      !invitation ||
      invitation.case.archivedAt ||
      invitation.status !== DatabaseCollaboratorStatus.PENDING
    ) {
      throw new NotFoundException("Collaboration invitation not found.");
    }

    return invitation;
  }

  /** Verifies that the signed-in account matches the invitation recipient. */
  private async loadInvitationUser(userId: string, invitedEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    if (!user) {
      throw new NotFoundException("Account not found.");
    }

    if (user.email.toLowerCase() !== invitedEmail.toLowerCase()) {
      throw new ForbiddenException(
        `Sign in as ${invitedEmail} to respond to this collaboration invitation.`
      );
    }

    return user;
  }
}
