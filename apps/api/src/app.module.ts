import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { CasesModule } from "./cases/cases.module.js";
import { CaseTypesModule } from "./case-types/case-types.module.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { HealthController } from "./health/health.controller.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueueModule } from "./queue/queue.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    AuthModule,
    CaseTypesModule,
    CasesModule,
    DocumentsModule,
    NotificationsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
