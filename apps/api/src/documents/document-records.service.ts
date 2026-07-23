import { Logger, NotFoundException } from "@nestjs/common";
import { analyzeCaseChecklist, DocumentStatus } from "@proofpilot/database";
import {
  createPresignedDownloadUrl,
  deleteStoredObject
} from "@proofpilot/storage";
import {
  buildCaseAccessSelect,
  buildCaseAccessWhere,
  createCaseAccess
} from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { DocumentAccessGuard } from "./document-access.guard.js";
import {
  isDemoSampleStorageKey,
  isUploadStagingKey
} from "./document-storage-keys.js";

/** Owns authorized document reads, download exposure, and deletion. */
export class DocumentRecordsService {
  private readonly logger = new Logger(DocumentRecordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DocumentAccessGuard
  ) {}

  /** Returns recent processing steps for one accessible document. */
  async getProcessingStatus(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(userId, "READ"),
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

  /** Lists evidence metadata for a readable case newest first. */
  async listForCase(userId: string, caseId: string) {
    await this.access.requireCase(userId, caseId, "READ");

    return this.prisma.document.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
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
  }

  /** Returns document analysis details and a permitted verified-object download URL. */
  async get(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        case: {
          ...buildCaseAccessWhere(userId, "READ"),
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
        source: true,
        sourceReference: true,
        sha256: true,
        extractedText: true,
        quarantinedAt: true,
        storageKey: true,
        uploadExpiredAt: true,
        case: {
          select: buildCaseAccessSelect(userId)
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
    const canDownload = createCaseAccess(userId, caseAccess).canDownload;
    const downloadBlocked =
      !canDownload ||
      Boolean(document.quarantinedAt) ||
      Boolean(uploadExpiredAt) ||
      isDemoSampleStorageKey(storageKey) ||
      isUploadStagingKey(storageKey) ||
      document.status === DocumentStatus.UPLOADED;

    return {
      ...publicDocument,
      downloadUrl: downloadBlocked
        ? null
        : await createPresignedDownloadUrl({ key: storageKey })
    };
  }

  /** Deletes all object versions, removes the record, and refreshes checklist readiness. */
  async remove(userId: string, documentId: string) {
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

    await Promise.all(
      [...storageKeys]
        .filter((key) => !isDemoSampleStorageKey(key))
        .map((key) => deleteStoredObject({ key }))
    );
    await this.prisma.document.delete({ where: { id: document.id } });

    await this.prisma.auditLog.create({
      data: {
        userId,
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
        actorId: userId,
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
}
