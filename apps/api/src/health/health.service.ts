import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueueHealthService } from "../queue/queue-health.service.js";

const dependencyHealthTimeoutMs = 3_000;

interface DependencyHealthCheck {
  error?: string;
  status: "ok" | "degraded";
}

interface QueueDependencyHealthCheck extends DependencyHealthCheck {
  unavailableQueues: string[];
}

export interface ApiReadinessResult {
  checks: {
    database: DependencyHealthCheck;
    queues: QueueDependencyHealthCheck;
  };
  service: "proofpilot-api";
  status: "ok" | "degraded";
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueHealthService: QueueHealthService
  ) {}

  async getReadiness(): Promise<ApiReadinessResult> {
    const [database, queues] = await Promise.all([
      this.checkDatabase(),
      this.checkQueues()
    ]);

    return {
      checks: {
        database,
        queues
      },
      service: "proofpilot-api",
      status: database.status === "ok" && queues.status === "ok" ? "ok" : "degraded",
      timestamp: new Date().toISOString()
    };
  }

  private async checkDatabase(): Promise<DependencyHealthCheck> {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, dependencyHealthTimeoutMs);
      return { status: "ok" };
    } catch (error) {
      this.logDependencyFailure("database", error);
      return {
        error: "Database health check failed.",
        status: "degraded"
      };
    }
  }

  private async checkQueues(): Promise<QueueDependencyHealthCheck> {
    try {
      const health = await withTimeout(
        this.queueHealthService.getHealth(),
        dependencyHealthTimeoutMs
      );
      const unavailableQueues = health.queues
        .filter((queue) => "error" in queue)
        .map((queue) => queue.name);

      if (unavailableQueues.length === 0) {
        return {
          status: "ok",
          unavailableQueues
        };
      }

      this.logDependencyFailure(
        "queues",
        new Error("One or more queue connections are unavailable."),
        { unavailableQueues }
      );
      return {
        error: "One or more queue connections are unavailable.",
        status: "degraded",
        unavailableQueues
      };
    } catch (error) {
      this.logDependencyFailure("queues", error);
      return {
        error: "Queue health check failed.",
        status: "degraded",
        unavailableQueues: []
      };
    }
  }

  private logDependencyFailure(
    dependency: "database" | "queues",
    error: unknown,
    context: Record<string, unknown> = {}
  ) {
    this.logger.error(
      JSON.stringify({
        dependency,
        errorName: error instanceof Error ? error.name : "UnknownError",
        event: "readiness_check_failed",
        message: error instanceof Error ? error.message : "Dependency health check failed.",
        ...context
      })
    );
  }
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Dependency health check timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
