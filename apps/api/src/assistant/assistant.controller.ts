import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { AssistantService } from "./assistant.service.js";
import { CreateAssistantMessageDto } from "./dto/create-assistant-message.dto.js";

@ApiTags("assistant")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("assistant")
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get("cases/:caseId")
  getWorkspace(
    @CurrentUser() user: RequestUser,
    @Param("caseId") caseId: string
  ) {
    return this.assistantService.getWorkspace(user.id, caseId);
  }

  @Post("cases/:caseId/messages")
  createMessage(
    @CurrentUser() user: RequestUser,
    @Param("caseId") caseId: string,
    @Body() input: CreateAssistantMessageDto
  ) {
    return this.assistantService.createMessage(user.id, caseId, input);
  }
}
