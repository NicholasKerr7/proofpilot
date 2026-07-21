import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { QueueHealthService } from "../queue/queue-health.service.js";
import { HealthService } from "./health.service.js";

function createPrismaMock() {
  return {
    $queryRaw: vi.fn()
  };
}

function createQueueHealthMock() {
  return {
    getHealth: vi.fn()
  };
}

function queueSnapshot(name: string, status: "ok" | "degraded" = "ok") {
  return {
    counts: {
      active: 0,
      completed: 2,
      delayed: 0,
      failed: status === "degraded" ? 1 : 0,
      paused: 0,
      prioritized: 0,
      waiting: 0,
      "waiting-children": 0
    },
    name,
    paused: false,
    status
  };
}

function queueHealthResult(
  queues: Array<ReturnType<typeof queueSnapshot> | { error: string; name: string; status: "degraded" }>
) {
  return {
    queues,
    status: queues.every((queue) => queue.status === "ok") ? ("ok" as const) : ("degraded" as const),
    timestamp: new Date().toISOString()
  };
}

describe("HealthService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let queueHealth: ReturnType<typeof createQueueHealthMock>;
  let service: HealthService;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    prisma = createPrismaMock();
    queueHealth = createQueueHealthMock();
    service = new HealthService(
      prisma as unknown as PrismaService,
      queueHealth as unknown as QueueHealthService
    );
    prisma.$queryRaw.mockResolvedValue([{ connected: 1 }]);
    queueHealth.getHealth.mockResolvedValue(
      queueHealthResult([
        queueSnapshot("document-processing"),
        queueSnapshot("packet-generation"),
        queueSnapshot("reminder-delivery")
      ])
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports ready when PostgreSQL and every queue connection respond", async () => {
    const result = await service.getReadiness();

    expect(result).toMatchObject({
      checks: {
        database: { status: "ok" },
        queues: { status: "ok", unavailableQueues: [] }
      },
      service: "proofpilot-api",
      status: "ok"
    });
    expect(Date.parse(result.timestamp)).not.toBeNaN();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("reports degraded when PostgreSQL cannot answer the readiness query", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("Database unavailable"));

    const result = await service.getReadiness();

    expect(result.status).toBe("degraded");
    expect(result.checks.database).toEqual({
      error: "Database health check failed.",
      status: "degraded"
    });
    expect(result.checks.queues.status).toBe("ok");
  });

  it("reports unavailable queue connections without exposing provider errors", async () => {
    queueHealth.getHealth.mockResolvedValue(
      queueHealthResult([
        queueSnapshot("document-processing"),
        {
          error: "connect ECONNREFUSED redis.internal:6379",
          name: "packet-generation",
          status: "degraded"
        },
        queueSnapshot("reminder-delivery")
      ])
    );

    const result = await service.getReadiness();

    expect(result.status).toBe("degraded");
    expect(result.checks.queues).toEqual({
      error: "One or more queue connections are unavailable.",
      status: "degraded",
      unavailableQueues: ["packet-generation"]
    });
    expect(JSON.stringify(result)).not.toContain("redis.internal");
    const [logEntry] = vi.mocked(Logger.prototype.error).mock.calls[0] ?? [];
    expect(JSON.parse(String(logEntry))).toMatchObject({
      dependency: "queues",
      event: "readiness_check_failed",
      unavailableQueues: ["packet-generation"]
    });
    expect(String(logEntry)).not.toContain("redis.internal");
  });

  it("keeps traffic ready when queues only contain retained failed jobs", async () => {
    queueHealth.getHealth.mockResolvedValue(
      queueHealthResult([
        queueSnapshot("document-processing", "degraded"),
        queueSnapshot("packet-generation"),
        queueSnapshot("reminder-delivery")
      ])
    );

    const result = await service.getReadiness();

    expect(result.status).toBe("ok");
    expect(result.checks.queues).toEqual({
      status: "ok",
      unavailableQueues: []
    });
  });

  it("reports a sanitized queue failure when the aggregate check rejects", async () => {
    queueHealth.getHealth.mockRejectedValue(new Error("Redis credentials rejected"));

    const result = await service.getReadiness();

    expect(result.status).toBe("degraded");
    expect(result.checks.queues).toEqual({
      error: "Queue health check failed.",
      status: "degraded",
      unavailableQueues: []
    });
    expect(JSON.stringify(result)).not.toContain("credentials");
  });
});
