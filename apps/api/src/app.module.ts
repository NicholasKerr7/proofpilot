import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { CasesModule } from "./cases/cases.module.js";
import { CaseTypesModule } from "./case-types/case-types.module.js";
import { HealthController } from "./health/health.controller.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CaseTypesModule,
    CasesModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
