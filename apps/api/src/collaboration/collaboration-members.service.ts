import {
  BadRequestException,
  NotFoundException
} from "@nestjs/common";
import type { CaseCollaborationResponse } from "@proofpilot/types";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CollaborationStore } from "./collaboration-store.js";
import type { UpdateCaseCollaborationSettingsDto } from "./dto/update-case-collaboration-settings.dto.js";
import type { UpdateCaseCollaboratorDto } from "./dto/update-case-collaborator.dto.js";

/** Owns owner-controlled collaborator roles, removal, and sharing settings. */
export class CollaborationMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: CollaborationStore
  ) {}

  /** Updates one collaborator role and records its previous value. */
  async update(
    ownerId: string,
    caseId: string,
    collaboratorId: string,
    input: UpdateCaseCollaboratorDto
  ): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.store.loadOwnedCase(ownerId, caseId);
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

    return this.store.get(ownerId, caseId);
  }

  /** Removes one case-scoped collaborator and records its final role and status. */
  async remove(
    ownerId: string,
    caseId: string,
    collaboratorId: string
  ): Promise<CaseCollaborationResponse> {
    const collaborationCase = await this.store.loadOwnedCase(ownerId, caseId);
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

    return this.store.get(ownerId, caseId);
  }

  /** Upserts changed sharing controls while rejecting empty updates. */
  async updateSettings(
    ownerId: string,
    caseId: string,
    input: UpdateCaseCollaborationSettingsDto
  ): Promise<CaseCollaborationResponse> {
    await this.store.loadOwnedCase(ownerId, caseId);
    const changedFields = [
      input.invitationExpiryDays !== undefined ? "invitationExpiryDays" : null,
      input.preventDownloads !== undefined ? "preventDownloads" : null
    ].filter((field): field is string => Boolean(field));

    if (!changedFields.length) {
      throw new BadRequestException(
        "Select at least one sharing setting to update."
      );
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

    return this.store.get(ownerId, caseId);
  }
}
