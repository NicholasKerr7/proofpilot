import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Post("login")
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.authService.findCurrentUser(user.id);
  }
}
