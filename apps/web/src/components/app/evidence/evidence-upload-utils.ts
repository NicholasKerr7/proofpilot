import {
  evidenceFileTypeListLabel,
  evidenceMaxUploadByteSize,
  evidenceMaxUploadSizeLabel,
  inferEvidenceMimeTypeFromName,
  isEvidenceMimeType,
  type EvidenceMimeType
} from "@proofpilot/types/evidence";
import type { CreateDocumentResponse } from "@/lib/client/types";

export type EvidenceUploadSource =
  | "camera"
  | "dropbox"
  | "email"
  | "files"
  | "google-drive"
  | "photos";

export type EvidenceUploadQueueStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "processing"
  | "processed"
  | "needs_review"
  | "failed";

export type EvidenceUploadQueueItem = {
  createdAt: number;
  documentId: string | null;
  error: string | null;
  file: File;
  id: string;
  progress: number;
  source: EvidenceUploadSource;
  status: EvidenceUploadQueueStatus;
};

export function createEvidenceUploadQueueItem(
  file: File,
  source: EvidenceUploadSource
): EvidenceUploadQueueItem {
  const validationError = getEvidenceFileValidationError(file);

  return {
    createdAt: Date.now(),
    documentId: null,
    error: validationError,
    file,
    id: createQueueItemId(),
    progress: 0,
    source,
    status: validationError ? "failed" : "queued"
  };
}

export function getEvidenceFileValidationError(file: File) {
  if (!getEvidenceUploadMimeType(file)) {
    return `Unsupported file type. Upload ${evidenceFileTypeListLabel}.`;
  }

  if (file.size < 1) {
    return "The selected file is empty.";
  }

  if (file.size > evidenceMaxUploadByteSize) {
    return `File is too large. Upload evidence under ${evidenceMaxUploadSizeLabel}.`;
  }

  return null;
}

export function getEvidenceUploadMimeType(file: File): EvidenceMimeType | null {
  if (isEvidenceMimeType(file.type)) {
    return file.type;
  }

  return inferEvidenceMimeTypeFromName(file.name);
}

export function uploadEvidenceToSignedUrl(
  file: File,
  createdDocument: CreateDocumentResponse,
  onProgress: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(createdDocument.upload.method, createdDocument.upload.url);

    Object.entries(createdDocument.upload.headers).forEach(([header, value]) => {
      request.setRequestHeader(header, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      reject(new Error("Signed upload failed. Check storage service configuration."));
    };
    request.onerror = () =>
      reject(new Error("Signed upload failed. Check storage service configuration."));
    request.send(file);
  });
}

export function mapDocumentStatusToQueueStatus(
  status: string
): EvidenceUploadQueueStatus | null {
  if (status === "UPLOADED" || status === "PROCESSING") {
    return "processing";
  }

  if (status === "PROCESSED") {
    return "processed";
  }

  if (status === "NEEDS_REVIEW") {
    return "needs_review";
  }

  if (status === "FAILED") {
    return "failed";
  }

  return null;
}

export function isFinishedQueueStatus(status: EvidenceUploadQueueStatus) {
  return status === "failed" || status === "needs_review" || status === "processed";
}

function createQueueItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
