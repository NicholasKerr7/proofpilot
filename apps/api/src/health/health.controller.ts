import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { QueueHealthService } from "../queue/queue-health.service.js";
import { HealthService } from "./health.service.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly queueHealthService: QueueHealthService
  ) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "proofpilot-api",
      timestamp: new Date().toISOString()
    };
  }

  @Get("ready")
  async readiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.healthService.getReadiness();
    response.status(
      readiness.status === "ok" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE
    );
    return readiness;
  }

  @Get("queues")
  queues() {
    return this.queueHealthService.getHealth();
  }
}
