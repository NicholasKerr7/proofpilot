import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { DocumentSource, DocumentStatus } from "@proofpilot/database";
import {
  createPresignedUploadUrl,
  deleteStoredObject,
  writeStoredObjectBytes
} from "@proofpilot/storage";
import type { ProviderImportProvider } from "@proofpilot/types";
import type { EvidenceMimeType } from "@proofpilot/types/evidence";
import { buildCaseAccessWhere } from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import {
  type DocumentProcessingQueueService,
  processUploadedDocumentJobName
} from "../queue/document-processing-queue.service.js";
import type { DocumentAccessGuard } from "./document-access.guard.js";
import { createUploadStorageKey } from "./document-storage-keys.js";
import { assertUploadMetadataAllowed } from "./document-upload-policy.js";
import type { DocumentUploadSecurityService } from "./document-upload-security.service.js";
import type { CreateDocumentDto } from "./dto/create-document.dto.js";

export interface DocumentCompletionResponse {
  alreadyCompleted?: boolean;
  documentId: string;
  processingJob: {
    id: string | null;
    name: string;
  };
}

type CompleteImportedUpload = (
  userId: string,
  documentId: string
) => Promise<DocumentCompletionResponse>;

/** Owns upload reservations, provider imports, completion claims, and reprocessing. */
export class DocumentUploadsService {
  private readonly logger = new Logger(DocumentUploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: DocumentProcessingQueueService,
    private readonly access: DocumentAccessGuard,
    private readonly security: DocumentUploadSecurityService
  ) {}

  /** Creates a staged upload reservation and returns its presigned PUT contract. */
  async create(userId: string, caseId: string, input: CreateDocumentDto) {
    assertUploadMetadataAllowed(input);

    const foundCase = await this.access.requireCase(userId, caseId, "EDIT");
    const storageKey = createUploadStorageKey(
      foundCase.ownerId,
      caseId,
      input.originalName
    );

    const document = await this.prisma.document.create({
      data: {
        caseId,
        originalName: input.originalName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        storageKey,
        status: DocumentStatus.UPLOADED,
        source: (input.source as DocumentSource | undefined) ?? DocumentSource.FILE_UPLOAD,
        versions: {
          create: {
            version: 1,
            storageKey
          }
        }
      },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
        status: true,
        source: true,
        sourceReference: true,
        sha256: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const uploadUrl = await createPresignedUploadUrl({
      key: storageKey,
      contentType: input.mimeType
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        caseId,
        action: "document.created_upload_url",
        metadata: {
          documentId: document.id,
          originalName: document.originalName,
          byteSize: document.byteSize,
          mimeType: document.mimeType
        }
      }
    });

    return {
      document,
      upload: {
        method: "PUT",
        url: uploadUrl,
        headers: {
          "Content-Type": input.mimeType
        },
        expiresInSeconds: 900
      }
    };
  }

  /** Stores provider bytes privately before entering the normal completion pipeline. */
  async importProviderEvidence(
    userId: string,
    caseId: string,
    input: {
      body: Buffer | Uint8Array;
      itemId: string;
      mimeType: EvidenceMimeType;
      originalName: string;
      provider: ProviderImportProvider;
    },
    completeImportedUpload: CompleteImportedUpload
  ) {
    const byteSize = input.body.byteLength;
    assertUploadMetadataAllowed({ byteSize, mimeType: input.mimeType });
    const foundCase = await this.access.requireCase(userId, caseId, "EDIT");
    const storageKey = createUploadStorageKey(
      foundCase.ownerId,
      caseId,
      input.originalName
    );
    const document = await this.prisma.document.create({
      data: {
        caseId,
        originalName: input.originalName,
        mimeType: input.mimeType,
        byteSize,
        storageKey,
        status: DocumentStatus.UPLOADED,
        source:
          input.provider === "GMAIL"
            ? DocumentSource.GMAIL_IMPORT
            : DocumentSource.GOOGLE_DRIVE_IMPORT,
        sourceReference: input.itemId,
        versions: {
          create: {
            version: 1,
            storageKey
          }
        }
      },
      select: { id: true }
    });

    try {
      await writeStoredObjectBytes({
        body: input.body,
        contentType: input.mimeType,
        key: storageKey
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          caseId,
          action: "document.imported_from_provider",
          metadata: {
            byteSize,
            documentId: document.id,
            itemId: input.itemId,
            mimeType: input.mimeType,
            originalName: input.originalName,
            provider: input.provider
          }
        }
      });
    } catch {
      await Promise.allSettled([
        deleteStoredObject({ key: storageKey }),
        this.prisma.document.delete({ where: { id: document.id } })
      ]);
      throw new ServiceUnavailableException(
        "Provider evidence could not be secured in private storage. Try again shortly."
      );
    }

    const completion = await completeImportedUpload(userId, document.id);
    const importedDocument = await this.prisma.document.findUnique({
      where: { id: document.id },
      select: {
        byteSize: true,
        createdAt: true,
        id: true,
        mimeType: true,
        originalName: true,
        status: true,
        source: true,
        sourceReference: true,
        sha256: true,
        updatedAt: true
      }
    });

    if (!importedDocument) {
      throw new NotFoundException("Imported document not found.");
    }

    return {
      document: {
        ...importedDocument,
        createdAt: importedDocument.createdAt.toISOString(),
        updatedAt: importedDocument.updatedAt.toISOString()
      },
      processingJob: completion.processingJob
    };
  }

  /** Claims, validates, scans, promotes, and queues one completed upload exactly once. */
  async complete(userId: string, documentId: string): Promise<DocumentCompletionResponse> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(userId, "EDIT"),
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true,
        byteSize: true,
        mimeType: true,
        originalName: true,
        storageKey: true,
        status: true,
        uploadExpiredAt: true,
        case: {
          select: { ownerId: true }
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    if (document.uploadExpiredAt) {
      throw new BadRequestException(
        "This upload reservation has expired. Upload the file again."
      );
    }

    if (document.status === DocumentStatus.FAILED) {
      throw new BadRequestException(
        "This upload has failed and cannot be completed. Upload the file again."
      );
    }

    if (document.status !== DocumentStatus.UPLOADED) {
      return createAlreadyCompletedResponse(document.id);
    }

    // The conditional status transition is the idempotency claim across concurrent requests.
    const claim = await this.prisma.document.updateMany({
      where: {
        id: document.id,
        status: DocumentStatus.UPLOADED,
        uploadExpiredAt: null
      },
      data: { status: DocumentStatus.PROCESSING }
    });

    if (!claim.count) {
      const current = await this.prisma.document.findUnique({
        where: { id: document.id },
        select: {
          status: true,
          uploadExpiredAt: true
        }
      });

      if (!current) {
        throw new NotFoundException("Document not found.");
      }

      if (current.uploadExpiredAt) {
        throw new BadRequestException(
          "This upload reservation has expired. Upload the file again."
        );
      }

      if (current.status === DocumentStatus.FAILED) {
        throw new BadRequestException(
          "This upload has failed and cannot be completed. Upload the file again."
        );
      }

      return createAlreadyCompletedResponse(document.id);
    }

    try {
      await this.security.secure(
        userId,
        document.case.ownerId,
        document
      );
    } catch (error) {
      await this.releaseCompletionClaim(document.id);
      throw error;
    }

    let job: Awaited<ReturnType<DocumentProcessingQueueService["addProcessDocumentJob"]>>;

    try {
      job = await this.queue.addProcessDocumentJob(
        {
          documentId: document.id,
          caseId: document.caseId,
          ownerId: document.case.ownerId
        },
        { jobId: document.id }
      );
    } catch (error) {
      await this.releaseCompletionClaim(document.id);
      throw error;
    }

    await this.prisma.$transaction([
      this.prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "upload_completed",
          status: "queued",
          message: "Upload completed and processing job was queued."
        }
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          caseId: document.caseId,
          action: "document.upload_completed",
          metadata: {
            documentId: document.id,
            originalName: document.originalName,
            jobId: job.id ?? null
          }
        }
      })
    ]);

    return {
      documentId: document.id,
      processingJob: {
        id: job.id ?? null,
        name: job.name
      }
    };
  }

  /** Rescans a completed object and submits a fresh processing attempt. */
  async reprocess(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(userId, "EDIT"),
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true,
        byteSize: true,
        mimeType: true,
        originalName: true,
        quarantinedAt: true,
        status: true,
        storageKey: true,
        uploadExpiredAt: true,
        updatedAt: true,
        case: {
          select: { ownerId: true }
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    if (document.quarantinedAt) {
      throw new BadRequestException("Quarantined uploads cannot be reprocessed.");
    }

    if (document.uploadExpiredAt) {
      throw new BadRequestException("Expired uploads cannot be reprocessed.");
    }

    if (document.status === DocumentStatus.UPLOADED) {
      throw new BadRequestException(
        "Upload completion is required before this document can be reprocessed."
      );
    }

    if (document.status === DocumentStatus.PROCESSING) {
      throw new BadRequestException("This document is already being processed.");
    }

    await this.security.secure(userId, document.case.ownerId, document);

    const job = await this.queue.addProcessDocumentJob({
      documentId: document.id,
      caseId: document.caseId,
      ownerId: document.case.ownerId
    });

    await this.prisma.document.updateMany({
      where: {
        id: document.id,
        updatedAt: document.updatedAt
      },
      data: { status: DocumentStatus.PROCESSING }
    });

    await this.prisma.documentProcessingLog.create({
      data: {
        documentId: document.id,
        step: "reprocess_requested",
        status: "queued",
        message: "Document reprocessing job was queued."
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        caseId: document.caseId,
        action: "document.reprocess_requested",
        metadata: {
          documentId: document.id,
          originalName: document.originalName,
          jobId: job.id ?? null
        }
      }
    });

    return {
      documentId: document.id,
      processingJob: {
        id: job.id ?? null,
        name: job.name
      }
    };
  }

  /** Restores an unquarantined completion claim when validation or queueing fails. */
  private async releaseCompletionClaim(documentId: string) {
    try {
      await this.prisma.document.updateMany({
        where: {
          id: documentId,
          quarantinedAt: null,
          status: DocumentStatus.PROCESSING,
          uploadExpiredAt: null
        },
        data: { status: DocumentStatus.UPLOADED }
      });
    } catch {
      this.logger.error(`Upload completion claim could not be released for ${documentId}.`);
    }
  }

}

/** Produces the idempotent response returned after another request owns completion. */
function createAlreadyCompletedResponse(documentId: string): DocumentCompletionResponse {
  return {
    documentId,
    alreadyCompleted: true,
    processingJob: {
      id: documentId,
      name: processUploadedDocumentJobName
    }
  };
}
