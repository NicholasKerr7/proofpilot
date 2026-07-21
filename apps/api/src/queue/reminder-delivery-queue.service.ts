import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { getApiEnv } from "../config/env.js";
import { getQueueHealthSnapshot } from "./queue-health-snapshot.js";
import { parseRedisConnection } from "./redis-connection.js";

export const reminderDeliveryQueueName = "reminder-delivery";

@Injectable()
export class ReminderDeliveryQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor() {
    this.queue = new Queue(reminderDeliveryQueueName, {
      connection: parseRedisConnection(getApiEnv().REDIS_URL)
    });
  }

  getHealthSnapshot() {
    return getQueueHealthSnapshot(this.queue, reminderDeliveryQueueName);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
