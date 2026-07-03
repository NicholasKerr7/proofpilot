import { Injectable } from "@nestjs/common";
import { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import { PacketGenerationQueueService } from "./packet-generation-queue.service.js";
import type { QueueHealthSnapshot } from "./queue-health-snapshot.js";

export interface QueueHealthResult {
  queues: (QueueHealthSnapshot | QueueHealthUnavailableSnapshot)[];
  status: "ok" | "degraded";
  timestamp: string;
}

interface QueueHealthUnavailableSnapshot {
  error: string;
  name: string;
  status: "degraded";
}

@Injectable()
export class QueueHealthService {
  constructor(
    private readonly documentProcessingQueue: DocumentProcessingQueueService,
    private readonly packetGenerationQueue: PacketGenerationQueueService
  ) {}

  async getHealth(): Promise<QueueHealthResult> {
    const queues = await Promise.all([
      this.getQueueHealth("document-processing", () =>
        this.documentProcessingQueue.getHealthSnapshot()
      ),
      this.getQueueHealth("packet-generation", () => this.packetGenerationQueue.getHealthSnapshot())
    ]);

    return {
      queues,
      status: queues.every((queue) => queue.status === "ok") ? "ok" : "degraded",
      timestamp: new Date().toISOString()
    };
  }

  private async getQueueHealth(
    name: string,
    getSnapshot: () => Promise<QueueHealthSnapshot>
  ): Promise<QueueHealthSnapshot | QueueHealthUnavailableSnapshot> {
    try {
      return await getSnapshot();
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Queue health check failed.",
        name,
        status: "degraded"
      };
    }
  }
}
