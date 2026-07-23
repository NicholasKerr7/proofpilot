import { Injectable } from "@nestjs/common";
import type { ProviderImportProvider } from "@proofpilot/types";
import type { EvidenceMimeType } from "@proofpilot/types/evidence";
import { PrismaService } from "../prisma/prisma.service.js";
import { DocumentProcessingQueueService } from "../queue/document-processing-queue.service.js";
import { DocumentAccessGuard } from "./document-access.guard.js";
import { DocumentRecordsService } from "./document-records.service.js";
import { DocumentUploadsService } from "./document-uploads.service.js";
import { DocumentUploadSecurityService } from "./document-upload-security.service.js";
import type { CreateDocumentDto } from "./dto/create-document.dto.js";
import { VirusScannerService } from "./virus-scanner.service.js";

/**
 * Stable controller-facing facade for document workflows.
 *
 * Upload orchestration, security validation, and document reads remain internal
 * modules so each lifecycle boundary can evolve and be tested independently.
 */
@Injectable()
export class DocumentsService {
  private readonly uploads: DocumentUploadsService;
  private readonly records: DocumentRecordsService;

  constructor(
    prisma: PrismaService,
    documentProcessingQueue: DocumentProcessingQueueService,
    virusScanner: VirusScannerService
  ) {
    const access = new DocumentAccessGuard(prisma);
    const security = new DocumentUploadSecurityService(prisma, virusScanner);

    this.uploads = new DocumentUploadsService(
      prisma,
      documentProcessingQueue,
      access,
      security
    );
    this.records = new DocumentRecordsService(prisma, access);
  }

  async create(userId: string, caseId: string, input: CreateDocumentDto) {
    return this.uploads.create(userId, caseId, input);
  }

  async importProviderEvidence(
    userId: string,
    caseId: string,
    input: {
      body: Buffer | Uint8Array;
      itemId: string;
      mimeType: EvidenceMimeType;
      originalName: string;
      provider: ProviderImportProvider;
    }
  ) {
    return this.uploads.importProviderEvidence(
      userId,
      caseId,
      input,
      (completionUserId, documentId) =>
        this.completeUpload(completionUserId, documentId)
    );
  }

  async completeUpload(userId: string, documentId: string) {
    return this.uploads.complete(userId, documentId);
  }

  async getProcessingStatus(userId: string, documentId: string) {
    return this.records.getProcessingStatus(userId, documentId);
  }

  async reprocess(userId: string, documentId: string) {
    return this.uploads.reprocess(userId, documentId);
  }

  async listForCase(userId: string, caseId: string) {
    return this.records.listForCase(userId, caseId);
  }

  async get(userId: string, documentId: string) {
    return this.records.get(userId, documentId);
  }

  async remove(userId: string, documentId: string) {
    return this.records.remove(userId, documentId);
  }
}
