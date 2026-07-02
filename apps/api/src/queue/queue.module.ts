import { Global, Module } from "@nestjs/common";
import { DocumentProcessingQueueService } from "./document-processing-queue.service.js";

@Global()
@Module({
  providers: [DocumentProcessingQueueService],
  exports: [DocumentProcessingQueueService]
})
export class QueueModule {}
