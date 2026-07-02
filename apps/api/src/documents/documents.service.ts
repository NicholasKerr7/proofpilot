import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentStatus } from "@proofpilot/database";
import { createPresignedDownloadUrl, createPresignedUploadUrl } from "@proofpilot/storage";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { PrismaService } from "../prisma/prisma.service.js";
import { DocumentProcessingQueueService } from "../queue/document-processing-queue.service.js";
import type { CreateDocumentDto } from "./dto/create-document.dto.js";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain"
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentProcessingQueue: DocumentProcessingQueueService
  ) {}

  async create(ownerId: string, caseId: string, input: CreateDocumentDto) {
    if (!allowedMimeTypes.has(input.mimeType)) {
      throw new BadRequestException("Unsupported file type. Upload PDF, PNG, JPG, JPEG, or TXT.");
    }

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
        originalName: true,
        status: true
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
      include: {
        entities: true,
        processingLogs: {
          orderBy: { createdAt: "desc" },
          take: 25
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    return {
      ...document,
      downloadUrl: await createPresignedDownloadUrl({ key: document.storageKey })
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
        originalName: true
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    await this.prisma.document.delete({
      where: { id: document.id }
    });

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
