import { NotFoundException } from "@nestjs/common";
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
import { createHash } from "node:crypto";
import type { PrismaService } from "../prisma/prisma.service.js";

export const collaboratorSeatLimit = 10;

const collaborationAuditActions = [
  "case.collaboration_invited",
  "case.collaboration_accepted",
  "case.collaboration_declined",
  "case.collaboration_role_updated",
  "case.collaboration_removed",
  "case.collaboration_settings_updated"
] as const;

export const collaboratorSelect = {
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
    orderBy: [{ status: "asc" }, { invitedAt: "desc" }],
    select: collaboratorSelect
  },
  sharingSettings: {
    select: {
      invitationExpiryDays: true,
      preventDownloads: true
    }
  }
} satisfies Prisma.CaseSelect;

export type OwnedCaseCollaborationRow = Prisma.CaseGetPayload<{
  select: typeof ownedCaseCollaborationSelect;
}>;

export type CollaboratorRow = Prisma.CaseCollaboratorGetPayload<{
  select: typeof collaboratorSelect;
}>;

/** Owns collaboration projections, activity history, and owner-only case loading. */
export class CollaborationStore {
  constructor(private readonly prisma: PrismaService) {}

  /** Loads and maps a complete owner-facing collaboration workspace. */
  async get(ownerId: string, caseId: string): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.loadOwnedCase(ownerId, caseId);
    const activity = await this.loadActivity(caseId);
    return toCollaborationResponse(collaborationCase, activity);
  }

  /** Returns an active case only when the caller is its owner. */
  async loadOwnedCase(
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

  /** Returns recent collaboration audit events as user-facing activity records. */
  private async loadActivity(
    caseId: string
  ): Promise<CaseCollaborationActivityRecord[]> {
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
}

/** Determines whether a pending collaborator no longer occupies an active seat. */
export function isExpiredCollaborator(
  collaborator: CollaboratorRow,
  now: Date
) {
  return (
    collaborator.status === DatabaseCollaboratorStatus.PENDING &&
    Boolean(collaborator.expiresAt && collaborator.expiresAt <= now)
  );
}

/** Normalizes persisted invitation expiry to one of the supported product options. */
export function getInvitationExpiryDays(
  value: number | undefined
): CaseInvitationExpiryDays {
  return caseInvitationExpiryOptions.includes(value as CaseInvitationExpiryDays)
    ? (value as CaseInvitationExpiryDays)
    : 7;
}

/** Hashes raw invitation tokens before any database comparison or persistence. */
export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Adds invitation lifetime in UTC calendar days. */
export function addInvitationDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

/** Maps database collaborators and sharing settings to the API response contract. */
function toCollaborationResponse(
  collaborationCase: OwnedCaseCollaborationRow,
  activity: CaseCollaborationActivityRecord[]
): CaseCollaborationResponse {
  const now = new Date();
  const collaborators = collaborationCase.collaborators.map((collaborator) =>
    toCollaboratorRecord(collaborator, now)
  );
  const invitationExpiryDays = getInvitationExpiryDays(
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

/** Serializes one collaborator and derives expired pending state. */
function toCollaboratorRecord(
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
    status: isExpiredCollaborator(collaborator, now)
      ? "EXPIRED"
      : collaborator.status
  };
}

/** Converts collaboration audit metadata into concise activity copy. */
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
    return {
      action: "ROLE_UPDATED",
      detail: `Changed a collaborator role to ${role}`
    };
  }

  if (action === "case.collaboration_removed") {
    return { action: "REMOVED", detail: "Removed a collaborator from the case" };
  }

  return {
    action: "SETTINGS_UPDATED",
    detail: "Updated case sharing controls"
  };
}

/** Narrows arbitrary Prisma JSON metadata to an object record. */
function toMetadataRecord(
  value: Prisma.JsonValue | null
): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;
}
