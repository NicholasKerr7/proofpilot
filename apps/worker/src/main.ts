import { Worker } from "bullmq";
import { getWorkerEnv } from "./config/env.js";
import {
  documentProcessingQueueName,
  type ProcessDocumentJobData
} from "./queues/document-processing.queue.js";
import {
  packetGenerationQueueName,
  type GeneratePacketJobData
} from "./queues/packet-generation.queue.js";
import {
  processUploadedDocument,
  shutdownDocumentProcessor
} from "./processors/document-processing.processor.js";
import { generateCasePacket } from "./processors/packet-generation.processor.js";

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

const documentWorker = new Worker<ProcessDocumentJobData>(
  documentProcessingQueueName,
  async (job) => {
    if (job.name === "process_uploaded_document") {
      return processUploadedDocument(job);
    }

    throw new Error(`Unsupported job name: ${job.name}`);
  },
  { connection }
);

const packetWorker = new Worker<GeneratePacketJobData>(
  packetGenerationQueueName,
  async (job) => {
    if (job.name === "generate_case_packet") {
      return generateCasePacket(job);
    }

    throw new Error(`Unsupported job name: ${job.name}`);
  },
  { connection }
);

attachWorkerLogging(documentWorker, documentProcessingQueueName);
attachWorkerLogging(packetWorker, packetGenerationQueueName);

process.on("SIGTERM", async () => {
  await Promise.all([documentWorker.close(), packetWorker.close()]);
  await shutdownDocumentProcessor();
});

function attachWorkerLogging(worker: Worker, queueName: string) {
  worker.on("ready", () => {
    console.log(`ProofPilot worker is listening on ${queueName}.`);
  });

  worker.on("failed", (job, error) => {
    console.error("ProofPilot worker job failed", {
      queueName,
      jobId: job?.id,
      name: job?.name,
      error: error.message
    });
  });
}
