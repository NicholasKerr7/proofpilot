import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { CreateReminderDto } from "./dto/create-reminder.dto.js";
import { NotificationsService } from "./notifications.service.js";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("notifications")
  list(@CurrentUser() user: RequestUser) {
    return this.notificationsService.list(user.id);
  }

  @Patch("notifications/:notificationId/read")
  markRead(@CurrentUser() user: RequestUser, @Param("notificationId") notificationId: string) {
    return this.notificationsService.markRead(user.id, notificationId);
  }

  @Get("reminders")
  listReminders(@CurrentUser() user: RequestUser) {
    return this.notificationsService.listReminders(user.id);
  }

  @Get("cases/:caseId/reminders")
  listCaseReminders(@CurrentUser() user: RequestUser, @Param("caseId") caseId: string) {
    return this.notificationsService.listCaseReminders(user.id, caseId);
  }

  @Post("cases/:caseId/reminders")
  createCaseReminder(
    @CurrentUser() user: RequestUser,
    @Param("caseId") caseId: string,
    @Body() input: CreateReminderDto
  ) {
    return this.notificationsService.createCaseReminder(user.id, caseId, input);
  }

  @Delete("reminders/:reminderId")
  deleteReminder(@CurrentUser() user: RequestUser, @Param("reminderId") reminderId: string) {
    return this.notificationsService.deleteReminder(user.id, reminderId);
  }
}
