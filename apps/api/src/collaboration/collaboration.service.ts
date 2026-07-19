import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
  type CaseInvitationExpiryDays
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import type { InviteCaseCollaboratorDto } from "./dto/invite-case-collaborator.dto.js";
import type { UpdateCaseCollaborationSettingsDto } from "./dto/update-case-collaboration-settings.dto.js";
import type { UpdateCaseCollaboratorDto } from "./dto/update-case-collaborator.dto.js";

const collaboratorSeatLimit = 10;
const collaborationAuditActions = [
  "case.collaboration_invited",
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
  constructor(private readonly prisma: PrismaService) {}

  async getCollaboration(ownerId: string, caseId: string): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.loadOwnedCase(ownerId, caseId);
    const activity = await this.loadActivity(caseId);

    return this.toResponse(collaborationCase, activity);
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

    const matchedUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true }
    });
    const expiryDays = this.getInvitationExpiryDays(
      collaborationCase.sharingSettings?.invitationExpiryDays
    );
    const expiresAt = addDays(now, expiryDays);

    await this.prisma.$transaction(async (tx) => {
      const collaborator = existing
        ? await tx.caseCollaborator.update({
            where: { id: existing.id },
            data: {
              acceptedAt: null,
              expiresAt,
              invitedAt: now,
              name: matchedUser?.name ?? existing.name,
              role: input.role,
              status: DatabaseCollaboratorStatus.PENDING,
              userId: matchedUser?.id ?? null
            },
            select: { id: true }
          })
        : await tx.caseCollaborator.create({
            data: {
              caseId,
              email,
              expiresAt,
              invitedAt: now,
              name: matchedUser?.name ?? null,
              role: input.role,
              status: DatabaseCollaboratorStatus.PENDING,
              userId: matchedUser?.id ?? null
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
    });

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

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}
