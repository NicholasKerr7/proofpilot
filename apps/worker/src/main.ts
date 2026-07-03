import { Worker } from "bullmq";
import { getWorkerEnv } from "./config/env.js";
import {
  documentProcessingQueueName,
  type ProcessDocumentJobData
} from "./queues/document-processing.queue.js";
import {
  processUploadedDocument,
  shutdownDocumentProcessor
} from "./processors/document-processing.processor.js";

const env = getWorkerEnv();
const redisUrl = new URL(env.REDIS_URL);
const connection: {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest: null;
} = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  maxRetriesPerRequest: null
};

if (redisUrl.username) {
  connection.username = decodeURIComponent(redisUrl.username);
}

if (redisUrl.password) {
  connection.password = decodeURIComponent(redisUrl.password);
}

const worker = new Worker<ProcessDocumentJobData>(
  documentProcessingQueueName,
  async (job) => {
    if (job.name === "process_uploaded_document") {
      return processUploadedDocument(job);
    }

    throw new Error(`Unsupported job name: ${job.name}`);
  },
  { connection }
);

worker.on("ready", () => {
  console.log(`ProofPilot worker is listening on ${documentProcessingQueueName}.`);
});

worker.on("failed", (job, error) => {
  console.error("ProofPilot worker job failed", {
    jobId: job?.id,
    name: job?.name,
    error: error.message
  });
});

process.on("SIGTERM", async () => {
  await worker.close();
  await shutdownDocumentProcessor();
});
