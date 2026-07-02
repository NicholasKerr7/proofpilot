import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { getApiEnv } from "../config/env.js";

export const documentProcessingQueueName = "document-processing";

export interface ProcessDocumentJobData {
  documentId: string;
  caseId: string;
  ownerId: string;
}

@Injectable()
export class DocumentProcessingQueueService implements OnModuleDestroy {
  private readonly queue: Queue<ProcessDocumentJobData>;

  constructor() {
    this.queue = new Queue<ProcessDocumentJobData>(documentProcessingQueueName, {
      connection: parseRedisConnection(getApiEnv().REDIS_URL)
    });
  }

  async addProcessDocumentJob(data: ProcessDocumentJobData) {
    return this.queue.add("process_uploaded_document", data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 1000
      },
      removeOnFail: false
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}

function parseRedisConnection(redisUrl: string) {
  const parsedUrl = new URL(redisUrl);
  const connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  } = {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 6379)
  };

  if (parsedUrl.username) {
    connection.username = decodeURIComponent(parsedUrl.username);
  }

  if (parsedUrl.password) {
    connection.password = decodeURIComponent(parsedUrl.password);
  }

  return connection;
}
