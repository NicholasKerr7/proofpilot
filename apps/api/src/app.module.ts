import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AssistantModule } from "./assistant/assistant.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { CollaborationModule } from "./collaboration/collaboration.module.js";
import { CasesModule } from "./cases/cases.module.js";
import { CaseTypesModule } from "./case-types/case-types.module.js";
import { ConnectionsModule } from "./connections/connections.module.js";
import { RateLimitMiddleware } from "./common/middleware/rate-limit.middleware.js";
import { RequestLoggingMiddleware } from "./common/middleware/request-logging.middleware.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { HealthController } from "./health/health.controller.js";
import { MonitoringModule } from "./monitoring/monitoring.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PacketSharingModule } from "./packet-sharing/packet-sharing.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { SearchModule } from "./search/search.module.js";
import { SecurityModule } from "./security/security.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { SupportModule } from "./support/support.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    MonitoringModule,
    AssistantModule,
    AuthModule,
    BillingModule,
    CollaborationModule,
    CaseTypesModule,
    ConnectionsModule,
    CasesModule,
    DocumentsModule,
    NotificationsModule,
    PacketSharingModule,
    ReportsModule,
    SearchModule,
    SecurityModule,
    SettingsModule,
    SupportModule
  ],
  controllers: [HealthController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware, RateLimitMiddleware).forRoutes("*");
  }
}
