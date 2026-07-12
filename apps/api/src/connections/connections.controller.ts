import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { ConnectionsService } from "./connections.service.js";

@ApiTags("connections")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("connections")
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.connectionsService.list(user.id);
  }

  @Post(":provider")
  connect(@CurrentUser() user: RequestUser, @Param("provider") provider: string) {
    return this.connectionsService.connect(user.id, provider);
  }

  @Delete(":provider")
  disconnect(@CurrentUser() user: RequestUser, @Param("provider") provider: string) {
    return this.connectionsService.disconnect(user.id, provider);
  }
}
