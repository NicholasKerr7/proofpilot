import { Injectable } from "@nestjs/common";
import { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import { NotificationEmailQueueService } from "./notification-email-queue.service.js";
import { PacketGenerationQueueService } from "./packet-generation-queue.service.js";
import { PacketShareEmailQueueService } from "./packet-share-email-queue.service.js";
import type { QueueHealthSnapshot } from "./queue-health-snapshot.js";
import { ReminderDeliveryQueueService } from "./reminder-delivery-queue.service.js";
import { UploadCleanupQueueService } from "./upload-cleanup-queue.service.js";

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
    private readonly notificationEmailQueue: NotificationEmailQueueService,
    private readonly packetGenerationQueue: PacketGenerationQueueService,
    private readonly packetShareEmailQueue: PacketShareEmailQueueService,
    private readonly reminderDeliveryQueue: ReminderDeliveryQueueService,
    private readonly uploadCleanupQueue: UploadCleanupQueueService
  ) {}

  async getHealth(): Promise<QueueHealthResult> {
    const queues = await Promise.all([
      this.getQueueHealth("document-processing", () =>
        this.documentProcessingQueue.getHealthSnapshot()
      ),
      this.getQueueHealth("notification-email", () =>
        this.notificationEmailQueue.getHealthSnapshot()
      ),
      this.getQueueHealth("packet-generation", () => this.packetGenerationQueue.getHealthSnapshot()),
      this.getQueueHealth("packet-share-email", () =>
        this.packetShareEmailQueue.getHealthSnapshot()
      ),
      this.getQueueHealth("reminder-delivery", () => this.reminderDeliveryQueue.getHealthSnapshot()),
      this.getQueueHealth("upload-cleanup", () => this.uploadCleanupQueue.getHealthSnapshot())
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
