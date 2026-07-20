import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { getApiEnv } from "../config/env.js";
import { getQueueHealthSnapshot } from "./queue-health-snapshot.js";
import { parseRedisConnection } from "./redis-connection.js";

export const documentProcessingQueueName = "document-processing";
export const processUploadedDocumentJobName = "process_uploaded_document";

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

  async addProcessDocumentJob(data: ProcessDocumentJobData, input: { jobId?: string } = {}) {
    return this.queue.add(processUploadedDocumentJobName, data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 1000
      },
      removeOnFail: false,
      ...(input.jobId ? { jobId: input.jobId } : {})
    });
  }

  getHealthSnapshot() {
    return getQueueHealthSnapshot(this.queue, documentProcessingQueueName);
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
