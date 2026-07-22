import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { PortfolioDemoPolicyService } from "../common/services/portfolio-demo-policy.service.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { CollaborationService } from "./collaboration.service.js";
import { InviteCaseCollaboratorDto } from "./dto/invite-case-collaborator.dto.js";
import { UpdateCaseCollaborationSettingsDto } from "./dto/update-case-collaboration-settings.dto.js";
import { UpdateCaseCollaboratorDto } from "./dto/update-case-collaborator.dto.js";

@ApiTags("case collaboration")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("cases/:caseId/collaboration")
export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly portfolioDemoPolicy: PortfolioDemoPolicyService
  ) {}

  @Get()
  getCollaboration(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string
  ) {
    return this.collaborationService.getCollaboration(user.id, caseId);
  }

  @Post("invitations")
  inviteCollaborator(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @Body() input: InviteCaseCollaboratorDto
  ) {
    this.portfolioDemoPolicy.assertExternalDeliveryAllowed(user);
    return this.collaborationService.inviteCollaborator(user.id, caseId, input);
  }

  @Patch("collaborators/:collaboratorId")
  updateCollaborator(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @ResourceIdParam("collaboratorId") collaboratorId: string,
    @Body() input: UpdateCaseCollaboratorDto
  ) {
    return this.collaborationService.updateCollaborator(
      user.id,
      caseId,
      collaboratorId,
      input
    );
  }

  @Delete("collaborators/:collaboratorId")
  removeCollaborator(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @ResourceIdParam("collaboratorId") collaboratorId: string
  ) {
    return this.collaborationService.removeCollaborator(user.id, caseId, collaboratorId);
  }

  @Patch("settings")
  updateSettings(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @Body() input: UpdateCaseCollaborationSettingsDto
  ) {
    return this.collaborationService.updateSettings(user.id, caseId, input);
  }
}
