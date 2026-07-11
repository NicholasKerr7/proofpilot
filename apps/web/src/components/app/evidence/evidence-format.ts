import { evidenceMimeTypeLabels, isEvidenceMimeType } from "@proofpilot/types/evidence";

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
