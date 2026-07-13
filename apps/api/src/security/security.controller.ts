import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { SecurityService } from "./security.service.js";

@ApiTags("security")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("security")
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get()
  getOverview(@CurrentUser() user: RequestUser) {
    return this.securityService.getOverview(user.id);
  }
}
