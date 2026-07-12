import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { UpdateSettingsDto } from "./dto/update-settings.dto.js";
import { SettingsService } from "./settings.service.js";

@ApiTags("settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.settingsService.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() input: UpdateSettingsDto) {
    return this.settingsService.update(user.id, input);
  }
}
