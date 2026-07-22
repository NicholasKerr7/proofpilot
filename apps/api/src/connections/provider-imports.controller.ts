import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { ImportProviderItemsDto } from "./dto/import-provider-items.dto.js";
import { ProviderImportsService } from "./provider-imports.service.js";

@ApiTags("provider imports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ProviderImportsController {
  constructor(private readonly providerImportsService: ProviderImportsService) {}

  @Get("cases/:caseId/provider-imports/:provider")
  getCatalog(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @Param("provider") provider: string
  ) {
    return this.providerImportsService.getCatalog(user.id, caseId, provider);
  }

  @Post("cases/:caseId/provider-imports/:provider")
  importItems(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @Param("provider") provider: string,
    @Body() input: ImportProviderItemsDto
  ) {
    return this.providerImportsService.importItems(user.id, caseId, provider, input);
  }
}
