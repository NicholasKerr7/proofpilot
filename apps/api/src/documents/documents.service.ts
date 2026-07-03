import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { DocumentStatus } from "@proofpilot/database";
import {
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
import { PrismaService } from "../prisma/prisma.service.js";
import { DocumentProcessingQueueService } from "../queue/document-processing-queue.service.js";
import type { CreateDocumentDto } from "./dto/create-document.dto.js";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentProcessingQueue: DocumentProcessingQueueService
  ) {}

  async create(ownerId: string, caseId: string, input: CreateDocumentDto) {
    this.assertUploadMetadataAllowed(input);

    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: { id: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const storageKey = this.createStorageKey(ownerId, caseId, input.originalName);

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
        case: { ownerId }
      },
      select: {
        id: true,
        caseId: true,
        byteSize: true,
        mimeType: true,
        originalName: true,
        storageKey: true,
        status: true
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    await this.assertCompletedUploadAllowed(ownerId, document);
    await this.recordVirusScanPlaceholder(ownerId, document);

    const job = await this.documentProcessingQueue.addProcessDocumentJob({
      documentId: document.id,
      caseId: document.caseId,
      ownerId
    });

    await this.prisma.documentProcessingLog.create({
      data: {
        documentId: document.id,
        step: "upload_completed",
        status: "queued",
        message: "Upload completed and processing job was queued."
      }
    });

    await this.prisma.auditLog.create({
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
    });

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
        case: { ownerId }
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
        case: { ownerId }
      },
      select: {
        id: true,
        caseId: true,
        originalName: true
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    const job = await this.documentProcessingQueue.addProcessDocumentJob({
      documentId: document.id,
      caseId: document.caseId,
      ownerId
    });

    await this.prisma.document.update({
      where: { id: document.id },
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
    await this.assertCaseOwnership(ownerId, caseId);

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
        case: { ownerId }
      },
      select: {
        id: true,
        caseId: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
        status: true,
        extractedText: true,
        storageKey: true,
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

    const { storageKey, ...publicDocument } = document;

    return {
      ...publicDocument,
      downloadUrl: await createPresignedDownloadUrl({ key: storageKey })
    };
  }

  async remove(ownerId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: { ownerId }
      },
      select: {
        id: true,
        caseId: true,
        originalName: true,
        storageKey: true,
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
  }

  private async rejectCompletedUpload(
    ownerId: string,
    document: CompletedUploadDocument,
    input: { deleteObject: boolean; message: string; reason: string }
  ) {
    let objectDeleted = false;
    let deleteError: string | null = null;

    if (input.deleteObject) {
      try {
        await deleteStoredObject({ key: document.storageKey });
        objectDeleted = true;
      } catch (error) {
        deleteError = error instanceof Error ? error.message : "Storage delete failed.";
      }
    }

    await this.prisma.$transaction([
      this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED }
      }),
      this.prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "upload_validation",
          status: "failed",
          message: input.message
        }
      }),
      this.prisma.auditLog.create({
        data: {
          userId: ownerId,
          caseId: document.caseId,
          action: "document.upload_rejected",
          metadata: {
            deleteError,
            documentId: document.id,
            objectDeleted,
            originalName: document.originalName,
            reason: input.reason
          }
        }
      })
    ]);
  }

  private async recordVirusScanPlaceholder(ownerId: string, document: CompletedUploadDocument) {
    await this.prisma.documentProcessingLog.create({
      data: {
        documentId: document.id,
        step: "virus_scan_placeholder",
        status: "skipped",
        message:
          "Virus scanning provider is not configured; upload metadata passed validation before processing."
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        caseId: document.caseId,
        action: "document.virus_scan_placeholder",
        metadata: {
          documentId: document.id,
          originalName: document.originalName,
          status: "skipped"
        }
      }
    });
  }

  private async assertCaseOwnership(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: { id: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }
  }

  private createStorageKey(ownerId: string, caseId: string, originalName: string) {
    const extension = extname(originalName).toLowerCase();
    const safeExtension = extension && extension.length <= 12 ? extension : "";
    return `users/${ownerId}/cases/${caseId}/documents/${randomUUID()}${safeExtension}`;
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
