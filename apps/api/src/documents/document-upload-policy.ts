import { BadRequestException } from "@nestjs/common";
import {
  evidenceFileTypeListLabel,
  evidenceMaxUploadByteSize,
  evidenceMaxUploadSizeLabel,
  isEvidenceMimeType
} from "@proofpilot/types/evidence";
import type { CreateDocumentDto } from "./dto/create-document.dto.js";

/** Rejects unsupported upload reservations before database or storage writes occur. */
export function assertUploadMetadataAllowed(
  input: Pick<CreateDocumentDto, "byteSize" | "mimeType">
) {
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

/** Detects S3-compatible missing-object responses across provider error shapes. */
export function isMissingStoredObjectError(error: unknown) {
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

/** Normalizes object-store content types before reservation comparison. */
export function normalizeContentType(contentType: string | null) {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? null;
}

/** Extracts a bounded infrastructure error code for audit metadata. */
export function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code.slice(0, 80) : null;
}
