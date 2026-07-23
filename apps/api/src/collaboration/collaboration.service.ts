import { Injectable } from "@nestjs/common";
import type {
  CaseCollaborationResponse,
  CaseInvitationDecisionResponse,
  CaseInvitationPreview
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import { CollaborationInvitationMailerService } from "./collaboration-invitation-mailer.service.js";
import { CollaborationInvitationsService } from "./collaboration-invitations.service.js";
import { CollaborationMembersService } from "./collaboration-members.service.js";
import { CollaborationStore } from "./collaboration-store.js";
import type { InviteCaseCollaboratorDto } from "./dto/invite-case-collaborator.dto.js";
import type { UpdateCaseCollaborationSettingsDto } from "./dto/update-case-collaboration-settings.dto.js";
import type { UpdateCaseCollaboratorDto } from "./dto/update-case-collaborator.dto.js";

/** Stable controller-facing facade for collaboration workflows. */
@Injectable()
export class CollaborationService {
  private readonly store: CollaborationStore;
  private readonly invitations: CollaborationInvitationsService;
  private readonly members: CollaborationMembersService;

  constructor(
    prisma: PrismaService,
    invitationMailer: CollaborationInvitationMailerService
  ) {
    this.store = new CollaborationStore(prisma);
    this.invitations = new CollaborationInvitationsService(
      prisma,
      invitationMailer,
      this.store
    );
    this.members = new CollaborationMembersService(prisma, this.store);
  }

  async getCollaboration(
    ownerId: string,
    caseId: string
  ): Promise<CaseCollaborationResponse> {
    return this.store.get(ownerId, caseId);
  }

  async getInvitationPreview(token: string): Promise<CaseInvitationPreview> {
    return this.invitations.getPreview(token);
  }

  async acceptInvitation(
    userId: string,
    token: string
  ): Promise<CaseInvitationDecisionResponse> {
    return this.invitations.accept(userId, token);
  }

  async declineInvitation(
    userId: string,
    token: string
  ): Promise<CaseInvitationDecisionResponse> {
    return this.invitations.decline(userId, token);
  }

  async inviteCollaborator(
    ownerId: string,
    caseId: string,
    input: InviteCaseCollaboratorDto
  ): Promise<CaseCollaborationResponse> {
    return this.invitations.invite(ownerId, caseId, input);
  }

  async updateCollaborator(
    ownerId: string,
    caseId: string,
    collaboratorId: string,
    input: UpdateCaseCollaboratorDto
  ): Promise<CaseCollaborationResponse> {
    return this.members.update(ownerId, caseId, collaboratorId, input);
  }

  async removeCollaborator(
    ownerId: string,
    caseId: string,
    collaboratorId: string
  ): Promise<CaseCollaborationResponse> {
    return this.members.remove(ownerId, caseId, collaboratorId);
  }

  async updateSettings(
    ownerId: string,
    caseId: string,
    input: UpdateCaseCollaborationSettingsDto
  ): Promise<CaseCollaborationResponse> {
    return this.members.updateSettings(ownerId, caseId, input);
  }
}
