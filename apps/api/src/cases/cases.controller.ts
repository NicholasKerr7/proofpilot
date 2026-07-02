import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { CasesService } from "./cases.service.js";
import { CreateCaseDto } from "./dto/create-case.dto.js";
import { UpdateCaseDto } from "./dto/update-case.dto.js";

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

  @Get(":id/timeline")
  listTimeline(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.listTimeline(user.id, id);
  }

  @Post(":id/timeline/analyze")
  analyzeTimeline(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.analyzeTimeline(user.id, id);
  }

  @Post(":id/checklist/analyze")
  analyzeChecklist(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.casesService.analyzeChecklist(user.id, id);
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
