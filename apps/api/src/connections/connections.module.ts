import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { ConnectionsController } from "./connections.controller.js";
import { ConnectionsService } from "./connections.service.js";
import { ProviderImportsController } from "./provider-imports.controller.js";
import { ProviderImportsService } from "./provider-imports.service.js";

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [ConnectionsController, ProviderImportsController],
  providers: [ConnectionsService, ProviderImportsService]
})
export class ConnectionsModule {}
