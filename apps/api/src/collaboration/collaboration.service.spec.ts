import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  CaseCollaboratorRole,
  CaseCollaboratorStatus
} from "@proofpilot/database";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CollaborationInvitationMailerService } from "./collaboration-invitation-mailer.service.js";
import { CollaborationService } from "./collaboration.service.js";

const ownerId = "owner-1";
const caseId = "case-1";

function createPrismaMock() {
  const transactionClient = {
    caseCollaborator: {
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    notification: {
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
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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

function createMailerMock() {
  return {
    send: vi.fn().mockResolvedValue(undefined)
  };
}

type MailerMock = ReturnType<typeof createMailerMock>;

function createService(prisma: PrismaMock, mailer: MailerMock) {
  return new CollaborationService(
    prisma as unknown as PrismaService,
    mailer as unknown as CollaborationInvitationMailerService
  );
}

function createCollaborationCase(overrides: Record<string, unknown> = {}) {
  return {
    id: caseId,
    title: "PayPal account appeal",
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

function createInvitation(overrides: Record<string, unknown> = {}) {
  return {
    caseId,
    email: "advisor@example.com",
    expiresAt: new Date("2099-07-28T16:00:00.000Z"),
    id: "collaborator-1",
    invitedAt: new Date("2026-07-21T16:00:00.000Z"),
    role: CaseCollaboratorRole.EDITOR,
    status: CaseCollaboratorStatus.PENDING,
    case: {
      archivedAt: null,
      ownerId,
      title: "PayPal account appeal",
      owner: {
        email: "owner@example.com",
        name: "Case Owner"
      }
    },
    ...overrides
  };
}

describe("CollaborationService", () => {
  let prisma: PrismaMock;
  let mailer: MailerMock;
  let service: CollaborationService;

  beforeEach(() => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot"
    );
    vi.stubEnv("JWT_SECRET", "a-secure-test-secret-with-enough-length");
    vi.stubEnv("WEB_ORIGIN", "https://app.proofpilot.test");
    prisma = createPrismaMock();
    mailer = createMailerMock();
    service = createService(prisma, mailer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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
    prisma.transactionClient.caseCollaborator.create.mockResolvedValue({ id: "collaborator-2" });

    await service.inviteCollaborator(ownerId, caseId, {
      email: "  NEW.Advisor@Example.COM ",
      role: "EDITOR"
    });

    expect(prisma.transactionClient.caseCollaborator.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId,
        email: "new.advisor@example.com",
        inviteTokenHash: expect.any(String),
        name: null,
        role: "EDITOR",
        status: CaseCollaboratorStatus.PENDING,
        userId: null
      }),
      select: { id: true }
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        caseTitle: "PayPal account appeal",
        ownerName: "Case Owner",
        role: "EDITOR",
        to: "new.advisor@example.com"
      })
    );
    const invitationUrl = new URL(mailer.send.mock.calls[0]?.[0]?.invitationUrl ?? "");
    const rawToken = invitationUrl.searchParams.get("inviteToken");
    const storedTokenHash =
      prisma.transactionClient.caseCollaborator.create.mock.calls[0]?.[0]?.data
        .inviteTokenHash;
    expect(rawToken).toBeTruthy();
    expect(storedTokenHash).not.toBe(rawToken);
    expect(storedTokenHash).toBe(
      createHash("sha256").update(rawToken ?? "").digest("hex")
    );
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

  it("invalidates an invitation when email delivery fails", async () => {
    prisma.case.findFirst.mockResolvedValue(createCollaborationCase());
    prisma.transactionClient.caseCollaborator.create.mockResolvedValue({
      id: "collaborator-2"
    });
    mailer.send.mockRejectedValue(new Error("Resend unavailable"));
    const loggerError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);

    await expect(
      service.inviteCollaborator(ownerId, caseId, {
        email: "advisor@example.com",
        role: "VIEWER"
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const storedTokenHash =
      prisma.transactionClient.caseCollaborator.create.mock.calls[0]?.[0]?.data
        .inviteTokenHash;
    expect(prisma.caseCollaborator.updateMany).toHaveBeenCalledWith({
      where: { id: "collaborator-2", inviteTokenHash: storedTokenHash },
      data: { expiresAt: expect.any(Date), inviteTokenHash: null }
    });
    expect(loggerError).toHaveBeenCalledWith(
      "Collaboration invitation delivery failed.",
      expect.any(String)
    );
  });

  it("returns a public invitation preview without exposing the token", async () => {
    prisma.caseCollaborator.findUnique.mockResolvedValue(createInvitation());

    const result = await service.getInvitationPreview("invitation-token");

    expect(prisma.caseCollaborator.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          inviteTokenHash: createHash("sha256")
            .update("invitation-token")
            .digest("hex")
        }
      })
    );
    expect(result).toEqual({
      caseTitle: "PayPal account appeal",
      expiresAt: "2099-07-28T16:00:00.000Z",
      invitedEmail: "advisor@example.com",
      ownerName: "Case Owner",
      role: "EDITOR",
      status: "PENDING"
    });
    expect(result).not.toHaveProperty("token");
  });

  it("marks an expired invitation preview and rejects acceptance", async () => {
    prisma.caseCollaborator.findUnique.mockResolvedValue(
      createInvitation({ expiresAt: new Date("2020-01-01T00:00:00.000Z") })
    );
    prisma.user.findUnique.mockResolvedValue({
      email: "advisor@example.com",
      name: "Advisor Person"
    });

    await expect(service.getInvitationPreview("expired-token")).resolves.toMatchObject({
      status: "EXPIRED"
    });
    await expect(service.acceptInvitation("user-2", "expired-token")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires the signed-in account to match the invited email", async () => {
    prisma.caseCollaborator.findUnique.mockResolvedValue(createInvitation());
    prisma.user.findUnique.mockResolvedValue({
      email: "someone-else@example.com",
      name: "Someone Else"
    });

    await expect(service.acceptInvitation("user-2", "invitation-token")).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts an invitation atomically and notifies the case owner", async () => {
    prisma.caseCollaborator.findUnique.mockResolvedValue(createInvitation());
    prisma.user.findUnique.mockResolvedValue({
      email: "advisor@example.com",
      name: "Advisor Person"
    });

    const result = await service.acceptInvitation("user-2", "invitation-token");

    expect(prisma.transactionClient.caseCollaborator.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "collaborator-1",
        inviteTokenHash: createHash("sha256")
          .update("invitation-token")
          .digest("hex"),
        status: CaseCollaboratorStatus.PENDING
      }),
      data: expect.objectContaining({
        expiresAt: null,
        inviteTokenHash: null,
        name: "Advisor Person",
        status: CaseCollaboratorStatus.ACTIVE,
        userId: "user-2"
      })
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        caseId,
        action: "case.collaboration_accepted",
        metadata: {
          collaboratorId: "collaborator-1",
          role: CaseCollaboratorRole.EDITOR
        }
      }
    });
    expect(prisma.transactionClient.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ownerId,
        caseId,
        type: "collaboration_invitation_accepted"
      })
    });
    expect(result).toMatchObject({
      caseId,
      ok: true,
      role: "EDITOR"
    });
  });

  it("rejects an invitation that was consumed by another request", async () => {
    prisma.caseCollaborator.findUnique.mockResolvedValue(createInvitation());
    prisma.user.findUnique.mockResolvedValue({
      email: "advisor@example.com",
      name: "Advisor Person"
    });
    prisma.transactionClient.caseCollaborator.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.acceptInvitation("user-2", "invitation-token")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.transactionClient.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.transactionClient.notification.create).not.toHaveBeenCalled();
  });

  it("declines an invitation atomically and notifies the case owner", async () => {
    prisma.caseCollaborator.findUnique.mockResolvedValue(createInvitation());
    prisma.user.findUnique.mockResolvedValue({
      email: "advisor@example.com",
      name: "Advisor Person"
    });

    const result = await service.declineInvitation("user-2", "invitation-token");

    expect(prisma.transactionClient.caseCollaborator.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "collaborator-1",
        inviteTokenHash: createHash("sha256")
          .update("invitation-token")
          .digest("hex"),
        status: CaseCollaboratorStatus.PENDING
      })
    });
    expect(prisma.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        caseId,
        action: "case.collaboration_declined",
        metadata: {
          collaboratorId: "collaborator-1",
          role: CaseCollaboratorRole.EDITOR
        }
      }
    });
    expect(prisma.transactionClient.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ownerId,
        caseId,
        type: "collaboration_invitation_declined"
      })
    });
    expect(result).toMatchObject({ caseId: null, ok: true });
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
