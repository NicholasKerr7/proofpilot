import { Queue, Worker } from "bullmq";
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
  notificationEmailQueueName,
  type DeliverNotificationEmailsJobData
} from "./queues/notification-email.queue.js";
import {
  reminderDeliveryQueueName,
  type DeliverRemindersJobData
} from "./queues/reminder-delivery.queue.js";
import {
  uploadCleanupQueueName,
  type ExpireAbandonedUploadsJobData
} from "./queues/upload-cleanup.queue.js";
import {
  processUploadedDocument,
  shutdownDocumentProcessor
} from "./processors/document-processing.processor.js";
import { deliverNotificationEmails } from "./processors/notification-email.processor.js";
import { generateCasePacket } from "./processors/packet-generation.processor.js";
import { deliverDueReminders } from "./processors/reminder-delivery.processor.js";
import { expireAbandonedUploads } from "./processors/upload-cleanup.processor.js";

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

const reminderQueue = new Queue<DeliverRemindersJobData>(reminderDeliveryQueueName, {
  connection
});
const reminderWorker = new Worker<DeliverRemindersJobData>(
  reminderDeliveryQueueName,
  async (job) => {
    if (job.name === "deliver_due_reminders") {
      return deliverDueReminders(job);
    }

    throw new Error(`Unsupported job name: ${job.name}`);
  },
  { connection }
);
const notificationEmailQueue = new Queue<DeliverNotificationEmailsJobData>(
  notificationEmailQueueName,
  { connection }
);
const notificationEmailWorker = new Worker<DeliverNotificationEmailsJobData>(
  notificationEmailQueueName,
  async (job) => {
    if (job.name === "deliver_notification_emails") {
      return deliverNotificationEmails(job);
    }

    throw new Error(`Unsupported job name: ${job.name}`);
  },
  { connection }
);
const uploadCleanupQueue = new Queue<ExpireAbandonedUploadsJobData>(uploadCleanupQueueName, {
  connection
});
const uploadCleanupWorker = new Worker<ExpireAbandonedUploadsJobData>(
  uploadCleanupQueueName,
  async (job) => {
    if (job.name === "expire_abandoned_uploads") {
      return expireAbandonedUploads(job);
    }

    throw new Error(`Unsupported job name: ${job.name}`);
  },
  { connection }
);

await reminderQueue.upsertJobScheduler(
  "deliver-due-reminders-every-minute",
  { every: 60_000 },
  {
    name: "deliver_due_reminders",
    data: {},
    opts: {
      removeOnComplete: 100,
      removeOnFail: 100
    }
  }
);
await notificationEmailQueue.upsertJobScheduler(
  "deliver-notification-emails-every-minute",
  { every: 60_000 },
  {
    name: "deliver_notification_emails",
    data: {},
    opts: {
      removeOnComplete: 100,
      removeOnFail: 100
    }
  }
);
await uploadCleanupQueue.upsertJobScheduler(
  "expire-abandoned-uploads-hourly",
  { every: 60 * 60 * 1_000 },
  {
    name: "expire_abandoned_uploads",
    data: {},
    opts: {
      removeOnComplete: 100,
      removeOnFail: 100
    }
  }
);

attachWorkerLogging(documentWorker, documentProcessingQueueName);
attachWorkerLogging(packetWorker, packetGenerationQueueName);
attachWorkerLogging(reminderWorker, reminderDeliveryQueueName);
attachWorkerLogging(notificationEmailWorker, notificationEmailQueueName);
attachWorkerLogging(uploadCleanupWorker, uploadCleanupQueueName);

process.on("SIGTERM", async () => {
  await Promise.all([
    documentWorker.close(),
    packetWorker.close(),
    reminderWorker.close(),
    reminderQueue.close(),
    notificationEmailWorker.close(),
    notificationEmailQueue.close(),
    uploadCleanupWorker.close(),
    uploadCleanupQueue.close()
  ]);
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

  worker.on("completed", (job) => {
    console.log("ProofPilot worker job completed", {
      queueName,
      jobId: job.id,
      name: job.name
    });
  });
}
