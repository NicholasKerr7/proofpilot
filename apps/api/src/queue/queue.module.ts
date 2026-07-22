import { Global, Module } from "@nestjs/common";
import { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import { NotificationEmailQueueService } from "./notification-email-queue.service.js";
import { PacketGenerationQueueService } from "./packet-generation-queue.service.js";
import { QueueHealthService } from "./queue-health.service.js";
import { ReminderDeliveryQueueService } from "./reminder-delivery-queue.service.js";
import { UploadCleanupQueueService } from "./upload-cleanup-queue.service.js";

@Global()
@Module({
  providers: [
    DocumentProcessingQueueService,
    NotificationEmailQueueService,
    PacketGenerationQueueService,
    ReminderDeliveryQueueService,
    UploadCleanupQueueService,
    QueueHealthService
  ],
  exports: [
    DocumentProcessingQueueService,
    NotificationEmailQueueService,
    PacketGenerationQueueService,
    ReminderDeliveryQueueService,
    UploadCleanupQueueService,
    QueueHealthService
  ]
})
export class QueueModule {}
