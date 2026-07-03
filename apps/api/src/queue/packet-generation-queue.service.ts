import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { getApiEnv } from "../config/env.js";
import { getQueueHealthSnapshot } from "./queue-health-snapshot.js";
import { parseRedisConnection } from "./redis-connection.js";

export const packetGenerationQueueName = "packet-generation";

export interface GeneratePacketJobData {
  packetId: string;
  caseId: string;
  ownerId: string;
}

@Injectable()
export class PacketGenerationQueueService implements OnModuleDestroy {
  private readonly queue: Queue<GeneratePacketJobData>;

  constructor() {
    this.queue = new Queue<GeneratePacketJobData>(packetGenerationQueueName, {
      connection: parseRedisConnection(getApiEnv().REDIS_URL)
    });
  }

  async addGeneratePacketJob(data: GeneratePacketJobData) {
    return this.queue.add("generate_case_packet", data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10000
      },
      jobId: data.packetId,
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 1000
      },
      removeOnFail: false
    });
  }

  getHealthSnapshot() {
    return getQueueHealthSnapshot(this.queue, packetGenerationQueueName);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
