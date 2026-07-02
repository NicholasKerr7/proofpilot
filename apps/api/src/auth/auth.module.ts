import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { getApiEnv } from "../config/env.js";

@Module({
  imports: [
    JwtModule.register({
      secret: getApiEnv().JWT_SECRET,
      signOptions: { expiresIn: "7d" }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule]
})
export class AuthModule {}
