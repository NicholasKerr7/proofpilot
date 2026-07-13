import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { AuthService, type AuthClientContext } from "./auth.service.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(
    @Body() input: RegisterDto,
    @Headers("x-proofpilot-client-user-agent") clientUserAgent?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.authService.register(
      input,
      createAuthClientContext(ipAddress, clientUserAgent ?? userAgent)
    );
  }

  @Post("login")
  login(
    @Body() input: LoginDto,
    @Headers("x-proofpilot-client-user-agent") clientUserAgent?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.authService.login(
      input,
      createAuthClientContext(ipAddress, clientUserAgent ?? userAgent)
    );
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return this.authService.findCurrentUser(user.id);
  }

  @Patch("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: RequestUser, @Body() input: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, input);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: RequestUser, @Body() input: ChangePasswordDto) {
    return this.authService.changePassword(user.id, input);
  }
}

function createAuthClientContext(
  ipAddress: string | undefined,
  userAgent: string | undefined
): AuthClientContext {
  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {})
  };
}
