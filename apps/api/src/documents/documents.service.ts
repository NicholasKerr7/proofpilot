import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { analyzeCaseChecklist, DocumentStatus } from "@proofpilot/database";
import {
  copyStoredObject,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  headStoredObject
} from "@proofpilot/storage";
import {
  evidenceFileTypeListLabel,
  evidenceMaxUploadByteSize,
  evidenceMaxUploadSizeLabel,
  isEvidenceMimeType
} from "@proofpilot/types/evidence";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import {
  buildCaseAccessSelect,
  buildCaseAccessWhere,
  createCaseAccess,
  type CaseAccessRequirement
} from "../common/case-access.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  DocumentProcessingQueueService,
  processUploadedDocumentJobName
} from "../queue/document-processing-queue.service.js";
import type { CreateDocumentDto } from "./dto/create-document.dto.js";
import {
  VirusScannerService,
  type VirusScanResult
} from "./virus-scanner.service.js";

interface CompletedUploadDocument {
  byteSize: number;
  caseId: string;
  id: string;
  mimeType: string;
  originalName: string;
  storageKey: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentProcessingQueue: DocumentProcessingQueueService,
    private readonly virusScanner: VirusScannerService
  ) {}

  async create(ownerId: string, caseId: string, input: CreateDocumentDto) {
    this.assertUploadMetadataAllowed(input);

    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(ownerId, "EDIT"),
        archivedAt: null
      },
      select: { id: true, ownerId: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const storageKey = this.createStorageKey(foundCase.ownerId, caseId, input.originalName);

    const document = await this.prisma.document.create({
      data: {
        caseId,
        originalName: input.originalName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        storageKey,
        status: DocumentStatus.UPLOADED,
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
        userId: ownerId,
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

  async completeUpload(ownerId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(ownerId, "EDIT"),
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
      return this.createAlreadyCompletedResponse(document.id);
    }

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

      return this.createAlreadyCompletedResponse(document.id);
    }

    try {
      const objectMetadata = await this.assertCompletedUploadAllowed(ownerId, document);
      await this.scanCompletedUpload(
        ownerId,
        document.case.ownerId,
        document,
        objectMetadata.etag
      );
    } catch (error) {
      await this.releaseUploadCompletionClaim(document.id);
      throw error;
    }

    let job: Awaited<ReturnType<DocumentProcessingQueueService["addProcessDocumentJob"]>>;

    try {
      job = await this.documentProcessingQueue.addProcessDocumentJob(
        {
          documentId: document.id,
          caseId: document.caseId,
          ownerId: document.case.ownerId
        },
        { jobId: document.id }
      );
    } catch (error) {
      await this.releaseUploadCompletionClaim(document.id);
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
          userId: ownerId,
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

  async getProcessingStatus(ownerId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(ownerId, "READ"),
          archivedAt: null
        }
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        processingLogs: {
          select: {
            id: true,
            step: true,
            status: true,
            message: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" },
          take: 25
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    return document;
  }

  async reprocess(ownerId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(ownerId, "EDIT"),
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

    const objectMetadata = await this.assertCompletedUploadAllowed(ownerId, document);
    await this.scanCompletedUpload(
      ownerId,
      document.case.ownerId,
      document,
      objectMetadata.etag
    );

    const job = await this.documentProcessingQueue.addProcessDocumentJob({
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
        userId: ownerId,
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

  async listForCase(ownerId: string, caseId: string) {
    await this.assertCaseAccess(ownerId, caseId, "READ");

    return this.prisma.document.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async get(ownerId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(ownerId, "READ"),
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
        status: true,
        extractedText: true,
        quarantinedAt: true,
        storageKey: true,
        uploadExpiredAt: true,
        case: {
          select: buildCaseAccessSelect(ownerId)
        },
        createdAt: true,
        updatedAt: true,
        entities: {
          select: {
            id: true,
            type: true,
            value: true,
            confidence: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" }
        },
        processingLogs: {
          select: {
            id: true,
            step: true,
            status: true,
            message: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" },
          take: 25
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    const { case: caseAccess, storageKey, uploadExpiredAt, ...publicDocument } = document;
    const canDownload = createCaseAccess(ownerId, caseAccess).canDownload;

    return {
      ...publicDocument,
      downloadUrl: !canDownload ||
        document.quarantinedAt ||
        uploadExpiredAt ||
        isUploadStagingKey(storageKey) ||
        document.status === DocumentStatus.UPLOADED
        ? null
        : await createPresignedDownloadUrl({ key: storageKey })
    };
  }

  async remove(ownerId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(ownerId, "EDIT"),
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true,
        originalName: true,
        storageKey: true,
        case: {
          select: { ownerId: true }
        },
        versions: {
          select: { storageKey: true }
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    const storageKeys = new Set([
      document.storageKey,
      ...document.versions.map((version) => version.storageKey)
    ]);

    await Promise.all([...storageKeys].map((key) => deleteStoredObject({ key })));

    await this.prisma.document.delete({ where: { id: document.id } });

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        caseId: document.caseId,
        action: "document.deleted",
        metadata: {
          documentId: document.id,
          originalName: document.originalName
        }
      }
    });

    try {
      await analyzeCaseChecklist(this.prisma, {
        actorId: ownerId,
        auditAction: "case.checklist_auto_analyzed",
        caseId: document.caseId,
        ownerId: document.case.ownerId,
        triggerDocumentId: document.id
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Checklist refresh failed after deletion.";
      this.logger.warn(`Checklist refresh failed after deleting ${document.id}: ${message}`);
    }

    return { id: document.id, deleted: true };
  }

  private assertUploadMetadataAllowed(input: Pick<CreateDocumentDto, "byteSize" | "mimeType">) {
    if (!isEvidenceMimeType(input.mimeType)) {
      throw new BadRequestException(
        `Unsupported file type. Upload ${evidenceFileTypeListLabel}.`
      );
    }

    if (!Number.isInteger(input.byteSize) || input.byteSize < 1) {
      throw new BadRequestException("File size must be a positive integer.");
    }

    if (input.byteSize > evidenceMaxUploadByteSize) {
      throw new BadRequestException(
        `File is too large. Upload evidence under ${evidenceMaxUploadSizeLabel}.`
      );
    }
  }

  private createAlreadyCompletedResponse(documentId: string) {
    return {
      documentId,
      alreadyCompleted: true,
      processingJob: {
        id: documentId,
        name: processUploadedDocumentJobName
      }
    };
  }

  private async releaseUploadCompletionClaim(documentId: string) {
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

  private async assertCompletedUploadAllowed(
    ownerId: string,
    document: CompletedUploadDocument
  ) {
    let objectMetadata: Awaited<ReturnType<typeof headStoredObject>>;

    try {
      objectMetadata = await headStoredObject({ key: document.storageKey });
    } catch (error) {
      if (!isMissingStoredObjectError(error)) {
        throw new ServiceUnavailableException(
          "Storage metadata could not be verified. Try again shortly."
        );
      }

      await this.rejectCompletedUpload(ownerId, document, {
        deleteObject: false,
        message: "Uploaded file was not found in storage.",
        reason: "missing_storage_object"
      });

      throw new BadRequestException(
        "Uploaded file could not be found in storage. Retry the upload before completing."
      );
    }

    const contentType = normalizeContentType(objectMetadata.contentType);

    if (objectMetadata.byteSize > evidenceMaxUploadByteSize) {
      await this.rejectCompletedUpload(ownerId, document, {
        deleteObject: true,
        message: `Uploaded file exceeded ${evidenceMaxUploadSizeLabel}.`,
        reason: "file_too_large"
      });

      throw new BadRequestException(
        `File is too large. Upload evidence under ${evidenceMaxUploadSizeLabel}.`
      );
    }

    if (objectMetadata.byteSize !== document.byteSize) {
      await this.rejectCompletedUpload(ownerId, document, {
        deleteObject: true,
        message: "Uploaded file size did not match the reserved upload.",
        reason: "byte_size_mismatch"
      });

      throw new BadRequestException("Uploaded file size does not match the reserved upload.");
    }

    if (contentType && contentType !== document.mimeType.toLowerCase()) {
      await this.rejectCompletedUpload(ownerId, document, {
        deleteObject: true,
        message: "Uploaded file content type did not match the reserved upload.",
        reason: "content_type_mismatch"
      });

      throw new BadRequestException("Uploaded file type does not match the reserved upload.");
    }

    return objectMetadata;
  }

  private async rejectCompletedUpload(
    ownerId: string,
    document: CompletedUploadDocument,
    input: { deleteObject: boolean; message: string; reason: string }
  ) {
    await this.quarantineUpload(document, {
      message: input.message,
      step: "upload_validation"
    });
    const deletion = input.deleteObject
      ? await this.deleteUploadObject(document.storageKey)
      : { deleteError: null, objectDeleted: false };

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        caseId: document.caseId,
        action: "document.upload_rejected",
        metadata: {
          ...deletion,
          documentId: document.id,
          originalName: document.originalName,
          reason: input.reason
        }
      }
    });
  }

  private async quarantineUpload(
    document: CompletedUploadDocument,
    input: { message: string; step: string }
  ) {
    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.FAILED,
          quarantinedAt: new Date()
        }
      }),
      this.prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: input.step,
          status: "failed",
          message: input.message
        }
      })
    ]);
  }

  private async scanCompletedUpload(
    actorId: string,
    storageOwnerId: string,
    document: CompletedUploadDocument,
    metadataEtag: string | null
  ) {
    let scan: Awaited<ReturnType<VirusScannerService["scanStoredObject"]>>;

    try {
      scan = await this.virusScanner.scanStoredObject({ key: document.storageKey });
    } catch (error) {
      await this.recordVirusScanFailure(actorId, document, error);
      throw new ServiceUnavailableException(
        "Upload security scanning is temporarily unavailable. Try completing the upload again shortly."
      );
    }

    const { result } = scan;

    if (result.status === "infected") {
      await this.rejectInfectedUpload(actorId, document, result);
      throw new BadRequestException(
        "The uploaded file did not pass security scanning and was quarantined."
      );
    }

    let promotion: Awaited<ReturnType<DocumentsService["promoteCompletedUpload"]>>;

    try {
      if (
        result.status === "clean" &&
        (!metadataEtag || !scan.sourceEtag || metadataEtag !== scan.sourceEtag)
      ) {
        throw Object.assign(
          new Error("The uploaded object changed during security validation."),
          { code: "UPLOAD_ETAG_CHANGED" }
        );
      }

      promotion = await this.promoteCompletedUpload(
        storageOwnerId,
        document,
        scan.sourceEtag ?? metadataEtag
      );
    } catch (error) {
      await this.recordVirusScanFailure(actorId, document, error);
      throw new ServiceUnavailableException(
        "The scanned upload could not be secured for processing. Try completing the upload again."
      );
    }

    const skipped = result.status === "skipped";
    await this.prisma.$transaction([
      this.prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "virus_scan",
          status: skipped ? "skipped" : "completed",
          message: skipped
            ? "Virus scanning is disabled in this non-production environment."
            : "ClamAV found no known threats in the uploaded file."
        }
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          caseId: document.caseId,
          action: skipped ? "document.virus_scan_skipped" : "document.virus_scan_completed",
          metadata: {
            documentId: document.id,
            engine: result.engine,
            originalName: document.originalName,
            promoted: promotion.promoted,
            stagingDeleteError: promotion.deleteError,
            stagingObjectDeleted: promotion.objectDeleted,
            status: result.status
          }
        }
      })
    ]);
  }

  private async promoteCompletedUpload(
    ownerId: string,
    document: CompletedUploadDocument,
    sourceEtag: string | null
  ) {
    if (!isUploadStagingKey(document.storageKey)) {
      return {
        deleteError: null,
        objectDeleted: false,
        promoted: false
      };
    }

    if (!sourceEtag) {
      throw Object.assign(new Error("The scanned upload did not include an object ETag."), {
        code: "MISSING_SOURCE_ETAG"
      });
    }

    const destinationKey = this.createVerifiedStorageKey(ownerId, document);
    await copyStoredObject({
      destinationKey,
      sourceEtag,
      sourceKey: document.storageKey
    });

    await this.prisma.$transaction([
      this.prisma.document.updateMany({
        where: {
          id: document.id,
          storageKey: document.storageKey
        },
        data: { storageKey: destinationKey }
      }),
      this.prisma.documentVersion.updateMany({
        where: {
          documentId: document.id,
          storageKey: document.storageKey
        },
        data: { storageKey: destinationKey }
      })
    ]);

    return {
      ...(await this.deleteUploadObject(document.storageKey)),
      promoted: true
    };
  }

  private async rejectInfectedUpload(
    ownerId: string,
    document: CompletedUploadDocument,
    result: Extract<VirusScanResult, { status: "infected" }>
  ) {
    await this.quarantineUpload(document, {
      message: "The uploaded file was blocked because a known threat was detected.",
      step: "virus_scan"
    });
    const deletion = await this.deleteUploadObject(document.storageKey);

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        caseId: document.caseId,
        action: "document.virus_detected",
        metadata: {
          ...deletion,
          documentId: document.id,
          engine: result.engine,
          originalName: document.originalName,
          status: result.status,
          threatName: result.threatName
        }
      }
    });
  }

  private async recordVirusScanFailure(
    ownerId: string,
    document: CompletedUploadDocument,
    error: unknown
  ) {
    await this.prisma.$transaction([
      this.prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "virus_scan",
          status: "failed",
          message: "Upload security checks could not be completed; processing was not queued."
        }
      }),
      this.prisma.auditLog.create({
        data: {
          userId: ownerId,
          caseId: document.caseId,
          action: "document.virus_scan_failed",
          metadata: {
            documentId: document.id,
            errorCode: getErrorCode(error),
            errorType: error instanceof Error ? error.name : "UnknownError",
            originalName: document.originalName,
            status: "failed"
          }
        }
      })
    ]);
  }

  private async deleteUploadObject(storageKey: string) {
    let objectDeleted = false;
    let deleteError: string | null = null;

    try {
      await deleteStoredObject({ key: storageKey });
      objectDeleted = true;
    } catch (error) {
      deleteError = error instanceof Error ? error.message : "Storage delete failed.";
    }

    return { deleteError, objectDeleted };
  }

  private async assertCaseAccess(
    ownerId: string,
    caseId: string,
    requirement: CaseAccessRequirement
  ) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(ownerId, requirement),
        archivedAt: null
      },
      select: { id: true, ownerId: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    return foundCase;
  }

  private createStorageKey(ownerId: string, caseId: string, originalName: string) {
    const extension = extname(originalName).toLowerCase();
    const safeExtension = extension && extension.length <= 12 ? extension : "";
    return `users/${ownerId}/cases/${caseId}/upload-staging/${randomUUID()}${safeExtension}`;
  }

  private createVerifiedStorageKey(ownerId: string, document: CompletedUploadDocument) {
    const extension = extname(document.originalName).toLowerCase();
    const safeExtension = extension && extension.length <= 12 ? extension : "";
    return `users/${ownerId}/cases/${document.caseId}/documents/${document.id}${safeExtension}`;
  }
}

function isMissingStoredObjectError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorWithMetadata = error as {
    $metadata?: { httpStatusCode?: number };
    Code?: string;
    code?: string;
    name?: string;
  };
  const statusCode = errorWithMetadata.$metadata?.httpStatusCode;
  const errorCode = errorWithMetadata.Code ?? errorWithMetadata.code ?? errorWithMetadata.name;

  return statusCode === 404 || errorCode === "NotFound" || errorCode === "NoSuchKey";
}

function normalizeContentType(contentType: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? null;
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code.slice(0, 80) : null;
}

function isUploadStagingKey(storageKey: string) {
  return storageKey.includes("/upload-staging/");
}
