import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { CreateCaseTaskDto } from "./dto/create-case-task.dto.js";
import { UpdateCaseTaskDto } from "./dto/update-case-task.dto.js";
import { TasksService } from "./tasks.service.js";

@ApiTags("tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get("tasks")
  list(@CurrentUser() user: RequestUser) {
    return this.tasksService.list(user.id);
  }

  @Post("cases/:caseId/tasks")
  create(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @Body() input: CreateCaseTaskDto
  ) {
    return this.tasksService.create(user.id, caseId, input);
  }

  @Patch("tasks/:taskId")
  update(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("taskId") taskId: string,
    @Body() input: UpdateCaseTaskDto
  ) {
    return this.tasksService.update(user.id, taskId, input);
  }

  @Delete("tasks/:taskId")
  delete(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("taskId") taskId: string
  ) {
    return this.tasksService.delete(user.id, taskId);
  }
}
