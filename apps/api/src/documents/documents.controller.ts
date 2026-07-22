import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { PortfolioDemoPolicyService } from "../common/services/portfolio-demo-policy.service.js";
import { ResourceIdParam } from "../common/validation/resource-id.js";
import { CreateDocumentDto } from "./dto/create-document.dto.js";
import { DocumentsService } from "./documents.service.js";

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly portfolioDemoPolicy: PortfolioDemoPolicyService
  ) {}

  @Post("cases/:caseId/documents")
  create(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("caseId") caseId: string,
    @Body() input: CreateDocumentDto
  ) {
    this.portfolioDemoPolicy.assertDirectUploadAllowed(user);
    return this.documentsService.create(user.id, caseId, input);
  }

  @Get("cases/:caseId/documents")
  listForCase(@CurrentUser() user: RequestUser, @ResourceIdParam("caseId") caseId: string) {
    return this.documentsService.listForCase(user.id, caseId);
  }

  @Get("documents/:documentId")
  get(@CurrentUser() user: RequestUser, @ResourceIdParam("documentId") documentId: string) {
    return this.documentsService.get(user.id, documentId);
  }

  @Post("documents/:documentId/complete")
  completeUpload(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("documentId") documentId: string
  ) {
    return this.documentsService.completeUpload(user.id, documentId);
  }

  @Get("documents/:documentId/processing-status")
  getProcessingStatus(
    @CurrentUser() user: RequestUser,
    @ResourceIdParam("documentId") documentId: string
  ) {
    return this.documentsService.getProcessingStatus(user.id, documentId);
  }

  @Post("documents/:documentId/reprocess")
  reprocess(@CurrentUser() user: RequestUser, @ResourceIdParam("documentId") documentId: string) {
    return this.documentsService.reprocess(user.id, documentId);
  }

  @Delete("documents/:documentId")
  remove(@CurrentUser() user: RequestUser, @ResourceIdParam("documentId") documentId: string) {
    return this.documentsService.remove(user.id, documentId);
  }
}
