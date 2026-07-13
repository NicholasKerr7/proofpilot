import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { CasesModule } from "./cases/cases.module.js";
import { CaseTypesModule } from "./case-types/case-types.module.js";
import { ConnectionsModule } from "./connections/connections.module.js";
import { RateLimitMiddleware } from "./common/middleware/rate-limit.middleware.js";
import { RequestLoggingMiddleware } from "./common/middleware/request-logging.middleware.js";
import { DocumentsModule } from "./documents/documents.module.js";
import { HealthController } from "./health/health.controller.js";
import { MonitoringModule } from "./monitoring/monitoring.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { SearchModule } from "./search/search.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { SupportModule } from "./support/support.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    MonitoringModule,
    AuthModule,
    BillingModule,
    CaseTypesModule,
    ConnectionsModule,
    CasesModule,
    DocumentsModule,
    NotificationsModule,
    ReportsModule,
    SearchModule,
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
