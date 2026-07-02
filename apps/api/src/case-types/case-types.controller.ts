import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CaseTypesService } from "./case-types.service.js";

@ApiTags("case-types")
@Controller("case-types")
export class CaseTypesController {
  constructor(private readonly caseTypesService: CaseTypesService) {}

  @Get()
  list() {
    return this.caseTypesService.list();
  }
}
