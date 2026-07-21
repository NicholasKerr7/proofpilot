import {
  Controller,
  Delete,
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
import { SecurityService } from "./security.service.js";

@ApiTags("security")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("security")
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get()
  getOverview(@CurrentUser() user: RequestUser) {
    return this.securityService.getOverview(user.id, user.sessionId);
  }

  @Delete("sessions/:sessionId")
  revokeSession(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("sessionId") sessionId: string
  ) {
    return this.securityService.revokeSession(user.id, user.sessionId, sessionId);
  }

  @Post("sessions/revoke-others")
  @HttpCode(HttpStatus.OK)
  revokeOtherSessions(@CurrentUser() user: RequestUser) {
    return this.securityService.revokeOtherSessions(user.id, user.sessionId);
  }
}
