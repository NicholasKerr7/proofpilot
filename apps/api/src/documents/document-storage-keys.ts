import { randomUUID } from "node:crypto";
import { extname } from "node:path";

/** Builds an isolated staging key for an unverified direct or provider upload. */
export function createUploadStorageKey(
  ownerId: string,
  caseId: string,
  originalName: string
) {
  return `users/${ownerId}/cases/${caseId}/upload-staging/${randomUUID()}${safeExtension(
    originalName
  )}`;
}

/** Builds the stable private key used only after security validation succeeds. */
export function createVerifiedStorageKey(
  ownerId: string,
  document: { caseId: string; id: string; originalName: string }
) {
  return `users/${ownerId}/cases/${document.caseId}/documents/${document.id}${safeExtension(
    document.originalName
  )}`;
}

/** Identifies objects that have not completed storage promotion. */
export function isUploadStagingKey(storageKey: string) {
  return storageKey.includes("/upload-staging/");
}

/** Identifies immutable evidence metadata bundled with the portfolio template. */
export function isDemoSampleStorageKey(storageKey: string) {
  return storageKey.startsWith("demo-samples/");
}

/** Retains only a short, conventional file extension in generated object keys. */
function safeExtension(originalName: string) {
  const extension = extname(originalName).toLowerCase();
  return extension && extension.length <= 12 ? extension : "";
}
