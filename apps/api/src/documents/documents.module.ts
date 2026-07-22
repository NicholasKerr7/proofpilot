import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";
import { VirusScannerService } from "./virus-scanner.service.js";

@Module({
  imports: [AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, VirusScannerService],
  exports: [DocumentsService]
})
export class DocumentsModule {}
