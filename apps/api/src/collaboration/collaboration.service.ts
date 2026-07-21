import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  CaseCollaboratorStatus as DatabaseCollaboratorStatus,
  Prisma
} from "@proofpilot/database";
import {
  caseInvitationExpiryOptions,
  type CaseCollaborationActivityAction,
  type CaseCollaborationActivityRecord,
  type CaseCollaborationResponse,
  type CaseCollaboratorRecord,
  type CaseCollaboratorRole,
  type CaseInvitationDecisionResponse,
  type CaseInvitationPreview,
  type CaseInvitationExpiryDays
} from "@proofpilot/types";
import { createHash, randomBytes } from "node:crypto";
import { getApiEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CollaborationInvitationMailerService } from "./collaboration-invitation-mailer.service.js";
import type { InviteCaseCollaboratorDto } from "./dto/invite-case-collaborator.dto.js";
import type { UpdateCaseCollaborationSettingsDto } from "./dto/update-case-collaboration-settings.dto.js";
import type { UpdateCaseCollaboratorDto } from "./dto/update-case-collaborator.dto.js";

const collaboratorSeatLimit = 10;
const collaborationAuditActions = [
  "case.collaboration_invited",
  "case.collaboration_accepted",
  "case.collaboration_declined",
  "case.collaboration_role_updated",
  "case.collaboration_removed",
  "case.collaboration_settings_updated"
] as const;

const collaboratorSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  invitedAt: true,
  expiresAt: true,
  acceptedAt: true
} satisfies Prisma.CaseCollaboratorSelect;

const ownedCaseCollaborationSelect = {
  id: true,
  ownerId: true,
  title: true,
  owner: {
    select: {
      email: true,
      name: true
    }
  },
  collaborators: {
    orderBy: [{ status: "asc" as const }, { invitedAt: "desc" as const }],
    select: collaboratorSelect
  },
  sharingSettings: {
    select: {
      invitationExpiryDays: true,
      preventDownloads: true
    }
  }
} satisfies Prisma.CaseSelect;

type OwnedCaseCollaborationRow = Prisma.CaseGetPayload<{
  select: typeof ownedCaseCollaborationSelect;
}>;
type CollaboratorRow = Prisma.CaseCollaboratorGetPayload<{
  select: typeof collaboratorSelect;
}>;

@Injectable()
export class CollaborationService {
  private readonly config = getApiEnv();
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationMailer: CollaborationInvitationMailerService
  ) {}

  async getCollaboration(ownerId: string, caseId: string): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.loadOwnedCase(ownerId, caseId);
    const activity = await this.loadActivity(caseId);

    return this.toResponse(collaborationCase, activity);
  }

  async getInvitationPreview(token: string): Promise<CaseInvitationPreview> {
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

  async acceptInvitation(
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
        throw new BadRequestException("This collaboration invitation is no longer available.");
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
      message: `You now have ${invitation.role === "EDITOR" ? "editor" : "viewer"} access to this case.`,
      ok: true,
      role: invitation.role as CaseCollaboratorRole
    };
  }

  async declineInvitation(
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
        throw new BadRequestException("This collaboration invitation is no longer available.");
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

  async inviteCollaborator(
    ownerId: string,
    caseId: string,
    input: InviteCaseCollaboratorDto
  ): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.loadOwnedCase(ownerId, caseId);
    const email = input.email.trim().toLowerCase();

    if (email === collaborationCase.owner.email.toLowerCase()) {
      throw new BadRequestException("The case owner cannot be invited as a collaborator.");
    }

    const now = new Date();
    const existing = collaborationCase.collaborators.find(
      (collaborator) => collaborator.email === email
    );

    if (existing?.status === DatabaseCollaboratorStatus.ACTIVE) {
      throw new BadRequestException("This person already collaborates on the case.");
    }

    const occupiedSeats = collaborationCase.collaborators.filter(
      (collaborator) => !this.isExpired(collaborator, now)
    ).length;
    const invitationAddsSeat = !existing || this.isExpired(existing, now);

    if (invitationAddsSeat && occupiedSeats >= collaboratorSeatLimit - 1) {
      throw new BadRequestException("This case has reached its collaborator seat limit.");
    }

    const expiryDays = this.getInvitationExpiryDays(
      collaborationCase.sharingSettings?.invitationExpiryDays
    );
    const expiresAt = addDays(now, expiryDays);
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
        ownerName: collaborationCase.owner.name ?? collaborationCase.owner.email,
        role: input.role,
        to: email
      });
    } catch (error) {
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

    return this.getCollaboration(ownerId, caseId);
  }

  async updateCollaborator(
    ownerId: string,
    caseId: string,
    collaboratorId: string,
    input: UpdateCaseCollaboratorDto
  ): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.loadOwnedCase(ownerId, caseId);
    const collaborator = collaborationCase.collaborators.find(
      (candidate) => candidate.id === collaboratorId
    );

    if (!collaborator) {
      throw new NotFoundException("Collaborator not found.");
    }

    await this.prisma.$transaction([
      this.prisma.caseCollaborator.update({
        where: { id: collaborator.id },
        data: { role: input.role }
      }),
      this.prisma.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.collaboration_role_updated",
          metadata: {
            collaboratorId: collaborator.id,
            previousRole: collaborator.role,
            role: input.role
          }
        }
      })
    ]);

    return this.getCollaboration(ownerId, caseId);
  }

  async removeCollaborator(
    ownerId: string,
    caseId: string,
    collaboratorId: string
  ): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.loadOwnedCase(ownerId, caseId);
    const collaborator = collaborationCase.collaborators.find(
      (candidate) => candidate.id === collaboratorId
    );

    if (!collaborator) {
      throw new NotFoundException("Collaborator not found.");
    }

    await this.prisma.$transaction([
      this.prisma.caseCollaborator.delete({ where: { id: collaborator.id } }),
      this.prisma.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.collaboration_removed",
          metadata: {
            collaboratorId: collaborator.id,
            role: collaborator.role,
            status: collaborator.status
          }
        }
      })
    ]);

    return this.getCollaboration(ownerId, caseId);
  }

  async updateSettings(
    ownerId: string,
    caseId: string,
    input: UpdateCaseCollaborationSettingsDto
  ): Promise<CaseCollaborationResponse> {
    await this.loadOwnedCase(ownerId, caseId);
    const changedFields = [
      input.invitationExpiryDays !== undefined ? "invitationExpiryDays" : null,
      input.preventDownloads !== undefined ? "preventDownloads" : null
    ].filter((field): field is string => Boolean(field));

    if (!changedFields.length) {
      throw new BadRequestException("Select at least one sharing setting to update.");
    }

    const data = {
      ...(input.invitationExpiryDays !== undefined
        ? { invitationExpiryDays: input.invitationExpiryDays }
        : {}),
      ...(input.preventDownloads !== undefined
        ? { preventDownloads: input.preventDownloads }
        : {})
    };

    await this.prisma.$transaction([
      this.prisma.caseSharingSettings.upsert({
        where: { caseId },
        update: data,
        create: {
          caseId,
          invitationExpiryDays: input.invitationExpiryDays ?? 7,
          preventDownloads: input.preventDownloads ?? false
        }
      }),
      this.prisma.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.collaboration_settings_updated",
          metadata: { changedFields }
        }
      })
    ]);

    return this.getCollaboration(ownerId, caseId);
  }

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

  private async loadOwnedCase(
    ownerId: string,
    caseId: string
  ): Promise<OwnedCaseCollaborationRow> {
    const collaborationCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: ownedCaseCollaborationSelect
    });

    if (!collaborationCase) {
      throw new NotFoundException("Case not found.");
    }

    return collaborationCase;
  }

  private async loadActivity(caseId: string): Promise<CaseCollaborationActivityRecord[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        caseId,
        action: { in: [...collaborationAuditActions] }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    return logs.map((log) => {
      const { action, detail } = toActivityContent(log.action, log.metadata);
      return {
        id: log.id,
        action,
        actorName: log.user.name ?? log.user.email,
        createdAt: log.createdAt.toISOString(),
        detail
      };
    });
  }

  private toResponse(
    collaborationCase: OwnedCaseCollaborationRow,
    activity: CaseCollaborationActivityRecord[]
  ): CaseCollaborationResponse {
    const now = new Date();
    const collaborators = collaborationCase.collaborators.map((collaborator) =>
      this.toCollaboratorRecord(collaborator, now)
    );
    const invitationExpiryDays = this.getInvitationExpiryDays(
      collaborationCase.sharingSettings?.invitationExpiryDays
    );

    return {
      activity,
      collaborators,
      owner: collaborationCase.owner,
      seatLimit: collaboratorSeatLimit,
      seatsUsed:
        1 + collaborators.filter((collaborator) => collaborator.status !== "EXPIRED").length,
      settings: {
        accessLogging: true,
        invitationExpiryDays,
        preventDownloads: collaborationCase.sharingSettings?.preventDownloads ?? false,
        secureSharing: true
      }
    };
  }

  private toCollaboratorRecord(
    collaborator: CollaboratorRow,
    now: Date
  ): CaseCollaboratorRecord {
    return {
      acceptedAt: collaborator.acceptedAt?.toISOString() ?? null,
      email: collaborator.email,
      expiresAt: collaborator.expiresAt?.toISOString() ?? null,
      id: collaborator.id,
      invitedAt: collaborator.invitedAt.toISOString(),
      name: collaborator.name,
      role: collaborator.role as CaseCollaboratorRole,
      status: this.isExpired(collaborator, now) ? "EXPIRED" : collaborator.status
    };
  }

  private isExpired(collaborator: CollaboratorRow, now: Date) {
    return (
      collaborator.status === DatabaseCollaboratorStatus.PENDING &&
      Boolean(collaborator.expiresAt && collaborator.expiresAt <= now)
    );
  }

  private getInvitationExpiryDays(value: number | undefined): CaseInvitationExpiryDays {
    return caseInvitationExpiryOptions.includes(value as CaseInvitationExpiryDays)
      ? (value as CaseInvitationExpiryDays)
      : 7;
  }
}

function toActivityContent(
  action: string,
  metadata: Prisma.JsonValue | null
): { action: CaseCollaborationActivityAction; detail: string } {
  const values = toMetadataRecord(metadata);
  const role = values?.role === "EDITOR" ? "Editor" : "Viewer";

  if (action === "case.collaboration_invited") {
    return {
      action: "INVITED",
      detail: `Created ${role === "Editor" ? "an" : "a"} ${role} invitation`
    };
  }

  if (action === "case.collaboration_accepted") {
    return { action: "ACCEPTED", detail: `Accepted ${role} access to the case` };
  }

  if (action === "case.collaboration_declined") {
    return { action: "DECLINED", detail: `Declined ${role} access to the case` };
  }

  if (action === "case.collaboration_role_updated") {
    return { action: "ROLE_UPDATED", detail: `Changed a collaborator role to ${role}` };
  }

  if (action === "case.collaboration_removed") {
    return { action: "REMOVED", detail: "Removed a collaborator from the case" };
  }

  return { action: "SETTINGS_UPDATED", detail: "Updated case sharing controls" };
}

function toMetadataRecord(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}
