import {
  CaseCollaboratorRole,
  CaseCollaboratorStatus,
  type Prisma
} from "@proofpilot/database";
import type { CaseAccess, CaseAccessRole } from "@proofpilot/types";

export type CaseAccessRequirement = "EDIT" | "OWNER" | "READ";

export function buildCaseAccessWhere(
  userId: string,
  requirement: CaseAccessRequirement
): Prisma.CaseWhereInput {
  if (requirement === "OWNER") {
    return { ownerId: userId };
  }

  return {
    OR: [
      { ownerId: userId },
      {
        collaborators: {
          some: {
            userId,
            status: CaseCollaboratorStatus.ACTIVE,
            ...(requirement === "EDIT" ? { role: CaseCollaboratorRole.EDITOR } : {})
          }
        }
      }
    ]
  };
}

export function buildCaseAccessInclude(userId: string) {
  return {
    owner: {
      select: {
        email: true,
        name: true
      }
    },
    collaborators: {
      where: {
        userId,
        status: CaseCollaboratorStatus.ACTIVE
      },
      select: { role: true },
      take: 1
    },
    sharingSettings: {
      select: { preventDownloads: true }
    }
  } satisfies Prisma.CaseInclude;
}

export function buildCaseAccessSelect(userId: string) {
  return {
    ownerId: true,
    collaborators: {
      where: {
        userId,
        status: CaseCollaboratorStatus.ACTIVE
      },
      select: { role: true },
      take: 1
    },
    sharingSettings: {
      select: { preventDownloads: true }
    }
  } satisfies Prisma.CaseSelect;
}

export function createCaseAccess(
  userId: string,
  source: {
    collaborators: Array<{ role: CaseCollaboratorRole }>;
    ownerId: string;
    sharingSettings: { preventDownloads: boolean } | null;
  }
): CaseAccess {
  const role: CaseAccessRole =
    source.ownerId === userId ? "OWNER" : (source.collaborators[0]?.role ?? "VIEWER");
  const canEdit = role === "OWNER" || role === "EDITOR";

  return {
    canDownload: canEdit || !source.sharingSettings?.preventDownloads,
    canEdit,
    canManage: role === "OWNER",
    role
  };
}
