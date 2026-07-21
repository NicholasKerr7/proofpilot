import { HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueHealthService } from "../queue/queue-health.service.js";
import { HealthController } from "./health.controller.js";
import type { ApiReadinessResult, HealthService } from "./health.service.js";

function createResponse() {
  return {
    status: vi.fn().mockReturnThis()
  } as unknown as Response;
}

function createReadiness(status: "ok" | "degraded"): ApiReadinessResult {
  return {
    checks: {
      database: { status },
      queues: {
        status,
        unavailableQueues: status === "ok" ? [] : ["packet-generation"]
      }
    },
    service: "proofpilot-api",
    status,
    timestamp: new Date().toISOString()
  };
}

describe("HealthController", () => {
  let healthService: { getReadiness: ReturnType<typeof vi.fn> };
  let queueHealthService: { getHealth: ReturnType<typeof vi.fn> };
  let controller: HealthController;

  beforeEach(() => {
    healthService = { getReadiness: vi.fn() };
    queueHealthService = { getHealth: vi.fn() };
    controller = new HealthController(
      healthService as unknown as HealthService,
      queueHealthService as unknown as QueueHealthService
    );
  });

  it("keeps the process liveness response dependency-free", () => {
    const result = controller.health();

    expect(result.status).toBe("ok");
    expect(result.service).toBe("proofpilot-api");
    expect(healthService.getReadiness).not.toHaveBeenCalled();
    expect(queueHealthService.getHealth).not.toHaveBeenCalled();
  });

  it("returns 200 when dependencies are ready", async () => {
    const readiness = createReadiness("ok");
    const response = createResponse();
    healthService.getReadiness.mockResolvedValue(readiness);

    await expect(controller.readiness(response)).resolves.toBe(readiness);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it("returns 503 when a required dependency is degraded", async () => {
    const readiness = createReadiness("degraded");
    const response = createResponse();
    healthService.getReadiness.mockResolvedValue(readiness);

    await expect(controller.readiness(response)).resolves.toBe(readiness);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it("preserves detailed queue diagnostics on the operations endpoint", () => {
    const queueHealth = { queues: [], status: "ok", timestamp: new Date().toISOString() };
    queueHealthService.getHealth.mockReturnValue(queueHealth);

    expect(controller.queues()).toBe(queueHealth);
  });
});
