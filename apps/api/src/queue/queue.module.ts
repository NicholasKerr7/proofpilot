import { Global, Module } from "@nestjs/common";
import { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import { PacketGenerationQueueService } from "./packet-generation-queue.service.js";

@Global()
@Module({
  providers: [DocumentProcessingQueueService, PacketGenerationQueueService],
  exports: [DocumentProcessingQueueService, PacketGenerationQueueService]
})
export class QueueModule {}
