import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { getApiEnv } from "../config/env.js";
import { PasswordResetMailerService } from "./password-reset-mailer.service.js";
import { PortfolioDemoWorkspaceService } from "./portfolio-demo-workspace.service.js";

@Module({
  imports: [
    JwtModule.register({
      secret: getApiEnv().JWT_SECRET,
      signOptions: { expiresIn: getApiEnv().AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordResetMailerService, PortfolioDemoWorkspaceService],
  exports: [AuthService, JwtModule]
})
export class AuthModule {}
