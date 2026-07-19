import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  CaseCollaboratorRole,
  CaseCollaboratorStatus
} from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { CollaborationService } from "./collaboration.service.js";

const ownerId = "owner-1";
const caseId = "case-1";

function createPrismaMock() {
  const transactionClient = {
    caseCollaborator: {
      create: vi.fn(),
      update: vi.fn()
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  const prisma = {
    transactionClient,
    case: {
      findFirst: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    caseCollaborator: {
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({})
    },
    caseSharingSettings: {
      upsert: vi.fn().mockResolvedValue({})
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([])
    },
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === "function") {
        return input(transactionClient);
      }

      return Promise.all(input as Promise<unknown>[]);
    })
  };

  return prisma;
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createService(prisma: PrismaMock) {
  return new CollaborationService(prisma as unknown as PrismaService);
}

function createCollaborationCase(overrides: Record<string, unknown> = {}) {
  return {
    id: caseId,
    owner: {
      email: "owner@example.com",
      name: "Case Owner"
    },
    collaborators: [],
    sharingSettings: {
      invitationExpiryDays: 7,
      preventDownloads: false
    },
    ...overrides
  };
}

function createCollaborator(overrides: Record<string, unknown> = {}) {
  return {
    id: "collaborator-1",
    email: "advisor@example.com",
    name: "Advisor Person",
    role: CaseCollaboratorRole.EDITOR,
    status: CaseCollaboratorStatus.ACTIVE,
    invitedAt: new Date("2026-07-10T16:00:00.000Z"),
    expiresAt: null,
    acceptedAt: new Date("2026-07-11T16:00:00.000Z"),
    ...overrides
  };
}

describe("CollaborationService", () => {
  let prisma: PrismaMock;
  let service: CollaborationService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = createService(prisma);
  });

  it("loads collaboration data only through an explicit case owner scope", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());

    const result = await service.getCollaboration(ownerId, caseId);

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: expect.any(Object)
    });
    expect(result).toMatchObject({
      owner: { email: "owner@example.com", name: "Case Owner" },
      seatLimit: 10,
      seatsUsed: 1,
      settings: {
        accessLogging: true,
        invitationExpiryDays: 7,
        preventDownloads: false,
        secureSharing: true
      }
    });
  });

  it("does not expose collaboration data outside the case owner scope", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.getCollaboration(ownerId, "case-other")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("formats editor invitation activity with the correct article", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "audit-1",
        action: "case.collaboration_invited",
        createdAt: new Date("2026-07-12T16:00:00.000Z"),
        metadata: { role: "EDITOR" },
        user: { email: "owner@example.com", name: "Case Owner" }
      }
    ]);

    const result = await service.getCollaboration(ownerId, caseId);

    expect(result.activity[0]?.detail).toBe("Created an Editor invitation");
  });

  it("marks expired pending invitations without consuming a seat", async () => {
    prisma.case.findFirst.mockResolvedValue(
      createCollaborationCase({
        collaborators: [
          createCollaborator({
            acceptedAt: null,
            expiresAt: new Date("2020-01-01T00:00:00.000Z"),
            status: CaseCollaboratorStatus.PENDING
          })
        ]
      })
    );

    const result = await service.getCollaboration(ownerId, caseId);

    expect(result.collaborators[0]?.status).toBe("EXPIRED");
    expect(result.seatsUsed).toBe(1);
  });

  it("rejects invitations sent to the case owner", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());

    await expect(
      service.inviteCollaborator(ownerId, caseId, {
        email: " OWNER@example.com ",
        role: "VIEWER"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects duplicate active collaborators", async () => {
    prisma.case.findFirst.mockResolvedValue(
      createCollaborationCase({ collaborators: [createCollaborator()] })
    );

    await expect(
      service.inviteCollaborator(ownerId, caseId, {
        email: "advisor@example.com",
        role: "VIEWER"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a normalized pending invitation and redacted audit event", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());
    prisma.user.findUnique.mockResolvedValue({ id: "user-2", name: "New Advisor" });
    prisma.transactionClient.caseCollaborator.create.mockResolvedValue({ id: "collaborator-2" });

    await service.inviteCollaborator(ownerId, caseId, {
      email: "  NEW.Advisor@Example.COM ",
      role: "EDITOR"
    });

    expect(prisma.transactionClient.caseCollaborator.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId,
        email: "new.advisor@example.com",
        name: "New Advisor",
        role: "EDITOR",
        status: CaseCollaboratorStatus.PENDING,
        userId: "user-2"
      }),
      select: { id: true }
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.collaboration_invited",
        metadata: {
          collaboratorId: "collaborator-2",
          renewed: false,
          role: "EDITOR"
        }
      }
    });
    expect(
      prisma.transactionClient.auditLog.create.mock.calls[0]?.[0]?.data.metadata
    ).not.toHaveProperty("email");
  });

  it("does not renew an expired invitation when all collaborator seats are occupied", async () => {
    const activeCollaborators = Array.from({ length: 9 }, (_, index) =>
      createCollaborator({
        email: `active-${index}@example.com`,
        id: `active-${index}`
      })
    );
    const expiredInvitation = createCollaborator({
      acceptedAt: null,
      email: "expired@example.com",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      id: "expired-invitation",
      status: CaseCollaboratorStatus.PENDING
    });
    prisma.case.findFirst.mockResolvedValue(
      createCollaborationCase({
        collaborators: [...activeCollaborators, expiredInvitation]
      })
    );

    await expect(
      service.inviteCollaborator(ownerId, caseId, {
        email: "expired@example.com",
        role: "VIEWER"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("requires an owned collaborator before changing a role", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());

    await expect(
      service.updateCollaborator(ownerId, caseId, "missing", { role: "VIEWER" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates a collaborator role and records the previous value", async () => {
    prisma.case.findFirst.mockResolvedValue(
      createCollaborationCase({ collaborators: [createCollaborator()] })
    );

    await service.updateCollaborator(ownerId, caseId, "collaborator-1", {
      role: "VIEWER"
    });

    expect(prisma.caseCollaborator.update).toHaveBeenCalledWith({
      where: { id: "collaborator-1" },
      data: { role: "VIEWER" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.collaboration_role_updated",
        metadata: {
          collaboratorId: "collaborator-1",
          previousRole: CaseCollaboratorRole.EDITOR,
          role: "VIEWER"
        }
      }
    });
  });

  it("removes only a collaborator attached to the owned case", async () => {
    prisma.case.findFirst.mockResolvedValue(
      createCollaborationCase({ collaborators: [createCollaborator()] })
    );

    await service.removeCollaborator(ownerId, caseId, "collaborator-1");

    expect(prisma.caseCollaborator.delete).toHaveBeenCalledWith({
      where: { id: "collaborator-1" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "case.collaboration_removed", caseId })
      })
    );
  });

  it("rejects empty sharing setting updates", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());

    await expect(service.updateSettings(ownerId, caseId, {})).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("persists sharing controls and audits only changed field names", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());

    await service.updateSettings(ownerId, caseId, {
      invitationExpiryDays: 14,
      preventDownloads: true
    });

    expect(prisma.caseSharingSettings.upsert).toHaveBeenCalledWith({
      where: { caseId },
      update: {
        invitationExpiryDays: 14,
        preventDownloads: true
      },
      create: {
        caseId,
        invitationExpiryDays: 14,
        preventDownloads: true
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.collaboration_settings_updated",
        metadata: {
          changedFields: ["invitationExpiryDays", "preventDownloads"]
        }
      }
    });
  });
});
