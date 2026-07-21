import { Global, Module } from "@nestjs/common";
import { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import { PacketGenerationQueueService } from "./packet-generation-queue.service.js";
import { QueueHealthService } from "./queue-health.service.js";
import { ReminderDeliveryQueueService } from "./reminder-delivery-queue.service.js";

@Global()
@Module({
  providers: [
    DocumentProcessingQueueService,
    PacketGenerationQueueService,
    ReminderDeliveryQueueService,
    QueueHealthService
  ],
  exports: [
    DocumentProcessingQueueService,
    PacketGenerationQueueService,
    ReminderDeliveryQueueService,
    QueueHealthService
  ]
})
export class QueueModule {}
