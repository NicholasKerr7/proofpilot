import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { CasesService } from "./cases.service.js";
import { CreateCaseDto } from "./dto/create-case.dto.js";
import { CreateTimelineEventDto } from "./dto/create-timeline-event.dto.js";
import { ListCaseActivityQueryDto } from "./dto/list-case-activity-query.dto.js";
import { ReorderTimelineEventsDto } from "./dto/reorder-timeline-events.dto.js";
import { SaveStatementDto } from "./dto/save-statement.dto.js";
import { UpdateCaseDto } from "./dto/update-case.dto.js";
import { UpdateTimelineEventDto } from "./dto/update-timeline-event.dto.js";

@ApiTags("cases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() input: CreateCaseDto) {
    return this.casesService.create(user.id, input);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.casesService.list(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.get(user.id, id);
  }

  @Get(":id/activity")
  listActivity(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Query() query: ListCaseActivityQueryDto
  ) {
    return this.casesService.listActivity(user.id, id, query);
  }

  @Get(":id/timeline")
  listTimeline(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.listTimeline(user.id, id);
  }

  @Post(":id/timeline")
  createTimelineEvent(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() input: CreateTimelineEventDto
  ) {
    return this.casesService.createTimelineEvent(user.id, id, input);
  }

  @Post(":id/timeline/analyze")
  analyzeTimeline(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.analyzeTimeline(user.id, id);
  }

  @Put(":id/timeline/order")
  reorderTimeline(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() input: ReorderTimelineEventsDto
  ) {
    return this.casesService.reorderTimeline(user.id, id, input);
  }

  @Patch(":id/timeline/:eventId")
  updateTimelineEvent(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("eventId") eventId: string,
    @Body() input: UpdateTimelineEventDto
  ) {
    return this.casesService.updateTimelineEvent(user.id, id, eventId, input);
  }

  @Delete(":id/timeline/:eventId")
  deleteTimelineEvent(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Param("eventId") eventId: string
  ) {
    return this.casesService.deleteTimelineEvent(user.id, id, eventId);
  }

  @Get(":id/checklist")
  listChecklist(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.listChecklist(user.id, id);
  }

  @Post(":id/checklist/analyze")
  analyzeChecklist(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.analyzeChecklist(user.id, id);
  }

  @Get(":id/statement")
  getStatement(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.getStatement(user.id, id);
  }

  @Put(":id/statement")
  saveStatement(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() input: SaveStatementDto
  ) {
    return this.casesService.saveStatement(user.id, id, input);
  }

  @Post(":id/statement/generate")
  generateStatement(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.generateStatement(user.id, id);
  }

  @Get(":id/packets")
  listPackets(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.listPackets(user.id, id);
  }

  @Post(":id/packet/generate")
  generatePacket(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.generatePacket(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() input: UpdateCaseDto
  ) {
    return this.casesService.update(user.id, id, input);
  }

  @Delete(":id")
  archive(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.archive(user.id, id);
  }
}
