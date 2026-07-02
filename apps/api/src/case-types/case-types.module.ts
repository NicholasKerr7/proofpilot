import { Module } from "@nestjs/common";
import { CaseTypesController } from "./case-types.controller.js";
import { CaseTypesService } from "./case-types.service.js";

@Module({
  controllers: [CaseTypesController],
  providers: [CaseTypesService]
})
export class CaseTypesModule {}
