import {
  BadRequestException,
  ServiceUnavailableException
} from "@nestjs/common";
import { DocumentStatus } from "@proofpilot/database";
import {
  copyStoredObject,
  deleteStoredObject,
  headStoredObject
} from "@proofpilot/storage";
import {
  evidenceMaxUploadByteSize,
  evidenceMaxUploadSizeLabel
} from "@proofpilot/types/evidence";
import type { PrismaService } from "../prisma/prisma.service.js";
import { createVerifiedStorageKey, isUploadStagingKey } from "./document-storage-keys.js";
import {
  getErrorCode,
  isMissingStoredObjectError,
  normalizeContentType
} from "./document-upload-policy.js";
import type {
  VirusScannerService,
  VirusScanResult
} from "./virus-scanner.service.js";

export interface CompletedUploadDocument {
  byteSize: number;
  caseId: string;
  id: string;
  mimeType: string;
  originalName: string;
  storageKey: string;
}

/** Validates, scans, fingerprints, and promotes uploaded objects before queueing. */
export class DocumentUploadSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly virusScanner: VirusScannerService
  ) {}

  /** Completes the storage security boundary for a staged or previously promoted object. */
  async secure(
    actorId: string,
    storageOwnerId: string,
    document: CompletedUploadDocument
  ) {
    const objectMetadata = await this.assertStoredUploadAllowed(actorId, document);
    await this.scanCompletedUpload(
      actorId,
      storageOwnerId,
      document,
      objectMetadata.etag
    );
  }

  /** Verifies object existence, byte size, and content type against the reservation. */
  private async assertStoredUploadAllowed(
    actorId: string,
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

      await this.rejectCompletedUpload(actorId, document, {
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
      await this.rejectCompletedUpload(actorId, document, {
        deleteObject: true,
        message: `Uploaded file exceeded ${evidenceMaxUploadSizeLabel}.`,
        reason: "file_too_large"
      });

      throw new BadRequestException(
        `File is too large. Upload evidence under ${evidenceMaxUploadSizeLabel}.`
      );
    }

    if (objectMetadata.byteSize !== document.byteSize) {
      await this.rejectCompletedUpload(actorId, document, {
        deleteObject: true,
        message: "Uploaded file size did not match the reserved upload.",
        reason: "byte_size_mismatch"
      });

      throw new BadRequestException("Uploaded file size does not match the reserved upload.");
    }

    if (contentType && contentType !== document.mimeType.toLowerCase()) {
      await this.rejectCompletedUpload(actorId, document, {
        deleteObject: true,
        message: "Uploaded file content type did not match the reserved upload.",
        reason: "content_type_mismatch"
      });

      throw new BadRequestException("Uploaded file type does not match the reserved upload.");
    }

    return objectMetadata;
  }

  /** Quarantines a reservation that fails storage metadata validation. */
  private async rejectCompletedUpload(
    actorId: string,
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
        userId: actorId,
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

  /** Marks an unsafe upload failed and records the failed security step atomically. */
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

  /** Runs malware scanning and promotes an unchanged clean object to verified storage. */
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

    let promotion: {
      deleteError: string | null;
      objectDeleted: boolean;
      promoted: boolean;
    };

    try {
      // The pre-scan and post-scan ETags bind validation to the exact same object bytes.
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
      this.prisma.document.update({
        where: { id: document.id },
        data: { sha256: scan.sha256 }
      }),
      this.prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "integrity_hash",
          status: "completed",
          message: "SHA-256 fingerprint recorded for provenance verification."
        }
      }),
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

  /** Copies a staged object to its verified key and updates every database reference. */
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

    const destinationKey = createVerifiedStorageKey(ownerId, document);
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

  /** Quarantines an infected object, removes its bytes, and records threat metadata. */
  private async rejectInfectedUpload(
    actorId: string,
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
        userId: actorId,
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

  /** Records an infrastructure or integrity failure without marking the object clean. */
  private async recordVirusScanFailure(
    actorId: string,
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
          userId: actorId,
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

  /** Best-effort object deletion with audit-friendly error details. */
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
}
