import { Global, Module } from "@nestjs/common";
import { ErrorMonitoringService } from "./error-monitoring.service.js";

@Global()
@Module({
  providers: [ErrorMonitoringService],
  exports: [ErrorMonitoringService]
})
export class MonitoringModule {}
