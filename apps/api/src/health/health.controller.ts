import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { QueueHealthService } from "../queue/queue-health.service.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly queueHealthService: QueueHealthService) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "proofpilot-api",
      timestamp: new Date().toISOString()
    };
  }

  @Get("queues")
  queues() {
    return this.queueHealthService.getHealth();
  }
}
