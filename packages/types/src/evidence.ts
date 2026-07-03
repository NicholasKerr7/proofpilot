export const docxMimeType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const emailMimeType = "message/rfc822";
export const csvMimeType = "text/csv";
export const xlsxMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const evidenceMaxUploadByteSize = 25 * 1024 * 1024;
export const evidenceMaxUploadSizeLabel = "25 MB";

export const evidenceMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  docxMimeType,
  emailMimeType,
  csvMimeType,
  xlsxMimeType
] as const;

export type EvidenceMimeType = (typeof evidenceMimeTypes)[number];

export const evidenceMimeTypeLabels = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "text/plain": "TXT",
  [docxMimeType]: "DOCX",
  [emailMimeType]: "EML",
  [csvMimeType]: "CSV",
  [xlsxMimeType]: "XLSX"
} satisfies Record<EvidenceMimeType, string>;

export const evidenceUploadAccept = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".docx",
  ".eml",
  ".csv",
  ".xlsx",
  ...evidenceMimeTypes
].join(",");

export const evidenceFileTypeListLabel =
  "PDF, PNG, JPG, JPEG, TXT, DOCX, EML, CSV, or XLSX";

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
    case "eml":
      return emailMimeType;
    case "csv":
      return csvMimeType;
    case "xlsx":
      return xlsxMimeType;
    default:
      return null;
  }
}
