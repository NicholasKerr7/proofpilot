import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { UpdateInboxReadStateDto } from "./dto/update-inbox-read-state.dto.js";
import { InboxService } from "./inbox.service.js";

@ApiTags("inbox")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("inbox")
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get("conversations")
  list(@CurrentUser() user: RequestUser) {
    return this.inboxService.list(user.id);
  }

  @Get("conversations/:source/:conversationId")
  get(
    @CurrentUser() user: RequestUser,
    @Param("source") source: string,
    @ResourceIdParam("conversationId") conversationId: string
  ) {
    return this.inboxService.get(user.id, source, conversationId);
  }

  @Patch("conversations/:source/:conversationId/read")
  updateReadState(
    @CurrentUser() user: RequestUser,
    @Param("source") source: string,
    @ResourceIdParam("conversationId") conversationId: string,
    @Body() input: UpdateInboxReadStateDto
  ) {
    return this.inboxService.updateReadState(user.id, source, conversationId, input.read);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.inboxService.markAllRead(user.id);
  }
}
