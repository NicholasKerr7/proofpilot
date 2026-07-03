import { Global, Module } from "@nestjs/common";
import { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import { PacketGenerationQueueService } from "./packet-generation-queue.service.js";
import { QueueHealthService } from "./queue-health.service.js";

@Global()
@Module({
  providers: [DocumentProcessingQueueService, PacketGenerationQueueService, QueueHealthService],
  exports: [DocumentProcessingQueueService, PacketGenerationQueueService, QueueHealthService]
})
export class QueueModule {}
