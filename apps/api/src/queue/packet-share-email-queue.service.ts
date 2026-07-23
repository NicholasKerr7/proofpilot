import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { getApiEnv } from "../config/env.js";
import { getQueueHealthSnapshot } from "./queue-health-snapshot.js";
import { parseRedisConnection } from "./redis-connection.js";

export const packetShareEmailQueueName = "packet-share-email";
export const deliverPacketShareEmailsJobName = "deliver_packet_share_emails";

export type DeliverPacketShareEmailsJobData = Record<string, never>;

@Injectable()
export class PacketShareEmailQueueService implements OnModuleDestroy {
  private readonly queue: Queue<DeliverPacketShareEmailsJobData>;

  constructor() {
    this.queue = new Queue<DeliverPacketShareEmailsJobData>(
      packetShareEmailQueueName,
      { connection: parseRedisConnection(getApiEnv().REDIS_URL) }
    );
  }

  triggerDelivery() {
    return this.queue.add(deliverPacketShareEmailsJobName, {}, {
      removeOnComplete: { age: 60 * 60, count: 100 },
      removeOnFail: { age: 24 * 60 * 60, count: 100 }
    });
  }

  getHealthSnapshot() {
    return getQueueHealthSnapshot(this.queue, packetShareEmailQueueName);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
