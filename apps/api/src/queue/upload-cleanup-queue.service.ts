import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { getApiEnv } from "../config/env.js";
import { getQueueHealthSnapshot } from "./queue-health-snapshot.js";
import { parseRedisConnection } from "./redis-connection.js";

export const uploadCleanupQueueName = "upload-cleanup";

@Injectable()
export class UploadCleanupQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor() {
    this.queue = new Queue(uploadCleanupQueueName, {
      connection: parseRedisConnection(getApiEnv().REDIS_URL)
    });
  }

  getHealthSnapshot() {
    return getQueueHealthSnapshot(this.queue, uploadCleanupQueueName);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
