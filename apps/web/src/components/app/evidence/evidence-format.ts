import {
  evidenceMimeTypeLabels,
  isEvidenceMimeType,
  type EvidenceSource
} from "@proofpilot/types/evidence";

export function formatEvidenceBytes(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatEvidenceStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatEvidenceMimeType(mimeType: string) {
  return isEvidenceMimeType(mimeType) ? evidenceMimeTypeLabels[mimeType] : mimeType;
}

export function formatEvidenceDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatEvidenceSource(source: EvidenceSource) {
  const labels = {
    CAMERA_SCAN: "Camera scan",
    DROPBOX_IMPORT: "Dropbox import",
    EMAIL_ATTACHMENT: "Email attachment",
    FILE_UPLOAD: "Device file",
    GMAIL_IMPORT: "Gmail import",
    GOOGLE_DRIVE_IMPORT: "Google Drive import",
    PHOTO_LIBRARY: "Photo library"
  } satisfies Record<EvidenceSource, string>;

  return labels[source];
}

export function getEvidenceStatusVariant(status: string) {
  if (status === "PROCESSED") {
    return "success";
  }

  if (status === "FAILED") {
    return "danger";
  }

  if (status === "NEEDS_REVIEW") {
    return "warning";
  }

  return "secondary";
}

export function isEvidenceProcessing(status: string | null | undefined) {
  return status === "UPLOADED" || status === "PROCESSING";
}
