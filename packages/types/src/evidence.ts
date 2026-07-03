export const docxMimeType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const evidenceMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  docxMimeType
] as const;

export type EvidenceMimeType = (typeof evidenceMimeTypes)[number];

export const evidenceMimeTypeLabels = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "text/plain": "TXT",
  [docxMimeType]: "DOCX"
} satisfies Record<EvidenceMimeType, string>;

export const evidenceUploadAccept = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".docx",
  ...evidenceMimeTypes
].join(",");

export const evidenceFileTypeListLabel = "PDF, PNG, JPG, JPEG, TXT, or DOCX";

const evidenceMimeTypeSet = new Set<string>(evidenceMimeTypes);

export function isEvidenceMimeType(value: string): value is EvidenceMimeType {
  return evidenceMimeTypeSet.has(value);
}

export function inferEvidenceMimeTypeFromName(originalName: string): EvidenceMimeType | null {
  const extension = originalName.toLowerCase().split(".").pop();

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "txt":
      return "text/plain";
    case "docx":
      return docxMimeType;
    default:
      return null;
  }
}
