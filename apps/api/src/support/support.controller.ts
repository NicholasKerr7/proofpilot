import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { CreateSupportRequestDto } from "./dto/create-support-request.dto.js";
import { RecordArticleFeedbackDto } from "./dto/record-article-feedback.dto.js";
import { SupportService } from "./support.service.js";

@ApiTags("support")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("support")
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get("requests")
  listRequests(@CurrentUser() user: RequestUser) {
    return this.supportService.listRequests(user.id);
  }

  @Post("requests")
  createRequest(
    @CurrentUser() user: RequestUser,
    @Body() input: CreateSupportRequestDto
  ) {
    return this.supportService.createRequest(user.id, input);
  }

  @Post("article-feedback")
  recordArticleFeedback(
    @CurrentUser() user: RequestUser,
    @Body() input: RecordArticleFeedbackDto
  ) {
    return this.supportService.recordArticleFeedback(user.id, input);
  }
}
