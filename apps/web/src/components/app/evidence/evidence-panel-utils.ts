import { apiRequest } from "@/lib/client/api";
import type {
  EvidenceDocumentDetail,
  EvidenceProcessingStatus
} from "@/lib/client/types";
import type { EvidenceUploadSource } from "@/components/app/evidence/evidence-upload-utils";

/** Fetches the full evidence analysis record used by the review workspace. */
export function fetchDocumentDetail(documentId: string) {
  return apiRequest<EvidenceDocumentDetail>(`/api/documents/${documentId}`);
}

/** Fetches lightweight processing state for polling. */
export function fetchProcessingStatus(documentId: string) {
  return apiRequest<EvidenceProcessingStatus>(
    `/api/documents/${documentId}/processing-status`
  );
}

/** Refreshes checklist intelligence after evidence processing settles. */
export function analyzeCaseChecklist(caseId: string) {
  return apiRequest(`/api/cases/${caseId}/checklist/analyze`, {
    method: "POST"
  });
}

/** Refreshes timeline intelligence after evidence processing settles. */
export function analyzeCaseTimeline(caseId: string) {
  return apiRequest(`/api/cases/${caseId}/timeline/analyze`, {
    method: "POST"
  });
}

/** Maps UI intake sources to the API's persisted source enum. */
export function toEvidenceSource(source: EvidenceUploadSource) {
  const sources = {
    camera: "CAMERA_SCAN",
    dropbox: "DROPBOX_IMPORT",
    email: "EMAIL_ATTACHMENT",
    files: "FILE_UPLOAD",
    "google-drive": "GOOGLE_DRIVE_IMPORT",
    photos: "PHOTO_LIBRARY"
  } as const;

  return sources[source];
}

/** Identifies document states that require continued polling. */
export function isActiveProcessingStatus(status: string | null | undefined) {
  return status === "UPLOADED" || status === "PROCESSING";
}

/** Identifies successful states that can contribute to case intelligence. */
export function shouldAnalyzeChecklistAfterProcessing(status: string) {
  return status === "PROCESSED" || status === "NEEDS_REVIEW";
}

/** Formats evidence counts for badges and queue notices. */
export function formatFileCount(count: number) {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

/** Moves focus between evidence subflows after their next layout paint. */
export function focusEvidenceSurface(
  elementId: string,
  scrollTarget: "element" | "page"
) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(elementId);

      if (scrollTarget === "page") {
        window.scrollTo({ behavior: "auto", left: 0, top: 0 });
      } else {
        target?.scrollIntoView({ behavior: "auto", block: "start" });
      }

      target?.focus({ preventScroll: true });
    });
  });
}

/** Resolves evidence-vault scrolling from OS and in-app motion preferences. */
export function getEvidenceScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reduceMotion === "true"
    ? "auto"
    : "smooth";
}
