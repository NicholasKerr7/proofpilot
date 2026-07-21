import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { CollaborationService } from "./collaboration.service.js";

@ApiTags("collaboration invitations")
@Controller("collaboration/invitations")
export class PublicCollaborationInvitationsController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get(":token")
  getInvitation(@ResourceIdParam("token") token: string) {
    return this.collaborationService.getInvitationPreview(token);
  }
}

@ApiTags("collaboration invitations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("collaboration/invitations")
export class CollaborationInvitationsController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Post(":token/accept")
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("token") token: string
  ) {
    return this.collaborationService.acceptInvitation(user.id, token);
  }

  @Post(":token/decline")
  @HttpCode(HttpStatus.OK)
  declineInvitation(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("token") token: string
  ) {
    return this.collaborationService.declineInvitation(user.id, token);
  }
}
