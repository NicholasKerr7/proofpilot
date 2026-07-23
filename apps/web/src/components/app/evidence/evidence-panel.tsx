"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProviderImportProvider, ProviderImportResponse } from "@proofpilot/types";
import { EvidenceCameraCapture } from "@/components/app/evidence/evidence-camera-capture";
import {
  fetchDocumentDetail,
  focusEvidenceSurface,
  formatFileCount,
  getEvidenceScrollBehavior
} from "@/components/app/evidence/evidence-panel-utils";
import type { EvidenceNotice } from "@/components/app/evidence/evidence-panel-types";
import { EvidenceRecentImports } from "@/components/app/evidence/evidence-recent-imports";
import { EvidenceReviewWorkspace } from "@/components/app/evidence/evidence-review-workspace";
import { EvidenceScanReview } from "@/components/app/evidence/evidence-scan-review";
import { EvidenceSourcePicker } from "@/components/app/evidence/evidence-source-picker";
import { EvidenceUploadQueue } from "@/components/app/evidence/evidence-upload-queue";
import {
  getEvidenceFileValidationError,
  getEvidenceUploadMimeType,
  type EvidenceUploadSource
} from "@/components/app/evidence/evidence-upload-utils";
import { ProviderImportWorkspace } from "@/components/app/evidence/provider-import-workspace";
import { useEvidenceUploadQueue } from "@/components/app/evidence/use-evidence-upload-queue";
import { useSelectedEvidenceProcessing } from "@/components/app/evidence/use-selected-evidence-processing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";
import type {
  CaseRecord,
  EvidenceDocument,
  EvidenceDocumentDetail,
  EvidenceProcessingStatus,
  ReprocessDocumentResponse
} from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface EvidencePanelProps {
  confirmBeforeDelete: boolean;
  selectedCase: CaseRecord;
  onDocumentsChanged: () => Promise<void>;
  onCaptureStateChange: (state: EvidenceCaptureState) => void;
  portfolioDemo: boolean;
}

export type EvidenceCaptureState =
  | "idle"
  | "camera"
  | "review"
  | "gmail"
  | "google-drive";

/** Coordinates evidence capture surfaces with the document vault and upload queue. */
export function EvidencePanel({
  confirmBeforeDelete,
  selectedCase,
  onDocumentsChanged,
  onCaptureStateChange,
  portfolioDemo
}: EvidencePanelProps) {
  const readOnly = selectedCase.access?.canEdit === false;
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<EvidenceDocumentDetail | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<EvidenceDocument | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderImportProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [notice, setNotice] = useState<EvidenceNotice | null>(null);

  const applyDocuments = useCallback(
    (nextDocuments: EvidenceDocument[], preferredDocumentId?: string) => {
      setDocuments(nextDocuments);
      setSelectedDocumentId((currentId) => {
        const targetId = preferredDocumentId ?? currentId;

        if (targetId && nextDocuments.some((document) => document.id === targetId)) {
          return targetId;
        }

        return nextDocuments[0]?.id ?? null;
      });
    },
    []
  );

  const applyDocumentStatuses = useCallback(
    (updates: Map<string, EvidenceProcessingStatus>) => {
      setDocuments((currentDocuments) =>
        currentDocuments.map((document) => {
          const statusUpdate = updates.get(document.id);

          return statusUpdate
            ? {
                ...document,
                status: statusUpdate.status,
                updatedAt: statusUpdate.updatedAt
              }
            : document;
        })
      );
    },
    []
  );

  const {
    activeUploadId,
    clearFinished,
    enqueueFiles: enqueueUploadFiles,
    items: uploadQueueItems,
    remove: removeUpload,
    reset: resetUploadQueue,
    retry: retryUpload,
    syncDocumentStatus,
    syncWithDocuments
  } = useEvidenceUploadQueue({
    caseId: selectedCase.id,
    onDocumentsChanged,
    onDocumentsLoaded: applyDocuments,
    onDocumentStatusesChanged: applyDocumentStatuses,
    readOnly,
    selectedDocumentId,
    setNotice
  });

  const refreshDocuments = useCallback(
    async (preferredDocumentId?: string) => {
      const nextDocuments = await apiRequest<EvidenceDocument[]>(
        `/api/cases/${selectedCase.id}/documents`
      );
      syncWithDocuments(nextDocuments);
      applyDocuments(nextDocuments, preferredDocumentId);
    },
    [applyDocuments, selectedCase.id, syncWithDocuments]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      setIsLoading(true);
      setNotice(null);
      setSelectedDocument(null);
      setSelectedDocumentId(null);
      resetUploadQueue();
      setScanFile(null);
      setIsCameraOpen(false);
      setActiveProvider(null);
      onCaptureStateChange("idle");

      try {
        const nextDocuments = await apiRequest<EvidenceDocument[]>(
          `/api/cases/${selectedCase.id}/documents`
        );

        if (isMounted) {
          setDocuments(nextDocuments);
          setSelectedDocumentId(nextDocuments[0]?.id ?? null);
          setIsVaultOpen(
            nextDocuments.length > 0 && window.matchMedia("(min-width: 1024px)").matches
          );
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Evidence could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => {
      isMounted = false;
    };
  }, [onCaptureStateChange, resetUploadQueue, selectedCase.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadDocumentDetail() {
      if (!selectedDocumentId) {
        setSelectedDocument(null);
        return;
      }

      setIsDetailLoading(true);

      try {
        const detail = await fetchDocumentDetail(selectedDocumentId);

        if (isMounted) {
          setSelectedDocument(detail);
        }
      } catch (error) {
        if (isMounted) {
          setSelectedDocument(null);
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Document detail could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadDocumentDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedDocumentId]);

  useSelectedEvidenceProcessing({
    caseId: selectedCase.id,
    onDocumentsChanged,
    readOnly,
    selectedDocumentId,
    selectedDocumentStatus: selectedDocument?.status,
    setDocuments,
    setNotice,
    setSelectedDocument,
    syncQueueDocumentStatus: syncDocumentStatus
  });

  /** Adds files selected from any intake surface to the shared upload queue. */
  function enqueueFiles(files: File[], source: EvidenceUploadSource) {
    enqueueUploadFiles(files, source);
  }

  /** Validates a camera result before opening the scan review surface. */
  function handleScanSelected(file: File) {
    const validationError = getEvidenceFileValidationError(file);
    const mimeType = getEvidenceUploadMimeType(file);

    if (validationError || (mimeType !== "image/png" && mimeType !== "image/jpeg")) {
      setNotice({
        tone: "error",
        text: validationError ?? "Camera scans must be PNG or JPEG images."
      });
      return;
    }

    setNotice(null);
    setScanFile(file);
    setIsCameraOpen(false);
    onCaptureStateChange("review");
    focusEvidenceSurface("scan-review-heading", "page");
  }

  /** Opens the camera capture surface and resets any prior scan. */
  function openCamera() {
    setNotice(null);
    setScanFile(null);
    setIsCameraOpen(true);
    onCaptureStateChange("camera");
    focusEvidenceSurface("camera-capture-heading", "page");
  }

  /** Opens one trusted provider import browser. */
  function openProviderImport(provider: ProviderImportProvider) {
    setNotice(null);
    setActiveProvider(provider);
    onCaptureStateChange(provider === "GMAIL" ? "gmail" : "google-drive");
    focusEvidenceSurface("provider-import-heading", "page");
  }

  /** Closes provider import and restores focus to evidence sources. */
  function closeProviderImport() {
    setActiveProvider(null);
    onCaptureStateChange("idle");
    focusEvidenceSurface("evidence-sources-heading", "element");
  }

  /** Refreshes evidence after a provider import enters processing. */
  async function handleProviderImported(response: ProviderImportResponse) {
    const preferredDocumentId = response.documents.at(-1)?.id;
    await refreshDocuments(preferredDocumentId);
    await onDocumentsChanged();
    setNotice({
      tone: "success",
      text: `${response.importedCount} ${
        response.importedCount === 1 ? "item was" : "items were"
      } imported and entered background processing.`
    });
    closeProviderImport();
  }

  /** Closes camera or scan review and restores the intake surface. */
  function closeCapture() {
    setScanFile(null);
    setIsCameraOpen(false);
    onCaptureStateChange("idle");
    focusEvidenceSurface("evidence-sources-heading", "element");
  }

  /** Rescans and queues a completed document for extraction. */
  async function handleReprocess() {
    if (!selectedDocument) {
      return;
    }

    setIsReprocessing(true);
    setNotice({ tone: "info", text: "Queueing document reprocessing..." });

    try {
      await apiRequest<ReprocessDocumentResponse>(
        `/api/documents/${selectedDocument.id}/reprocess`,
        { method: "POST" }
      );
      await refreshDocuments(selectedDocument.id);
      setSelectedDocument(await fetchDocumentDetail(selectedDocument.id));
      await onDocumentsChanged();
      setNotice({ tone: "success", text: "Document reprocessing was queued." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Document could not be reprocessed."
      });
    } finally {
      setIsReprocessing(false);
    }
  }

  /** Deletes evidence and refreshes case-derived state. */
  async function deleteDocument(document: EvidenceDocument) {
    setIsDeleting(true);
    setNotice(null);

    try {
      await apiRequest(`/api/documents/${document.id}`, { method: "DELETE" });
      await refreshDocuments();
      await onDocumentsChanged();
      setNotice({ tone: "success", text: "Evidence deleted." });
      setDocumentToDelete(null);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Evidence could not be deleted."
      });
    } finally {
      setIsDeleting(false);
    }
  }

  /** Applies the user's delete-confirmation preference. */
  function handleRequestDelete(document: EvidenceDocument) {
    if (confirmBeforeDelete) {
      setDocumentToDelete(document);
    } else {
      void deleteDocument(document);
    }
  }

  /** Opens the evidence vault and optionally selects a document. */
  function openVault(documentId?: string) {
    if (documentId) {
      setSelectedDocumentId(documentId);
    }

    setIsVaultOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById("evidence-vault")?.scrollIntoView({
          behavior: getEvidenceScrollBehavior(),
          block: "start"
        });
      });
    });
  }

  const attentionDocumentCount = documents.filter(
    (document) => document.status === "FAILED" || document.status === "NEEDS_REVIEW"
  ).length;

  if (activeProvider) {
    return (
      <div id="evidence-intake" className="scroll-mt-28 lg:scroll-mt-24">
        <ProviderImportWorkspace
          caseRecord={selectedCase}
          onBack={closeProviderImport}
          onImported={handleProviderImported}
          provider={activeProvider}
        />
      </div>
    );
  }

  if (isCameraOpen) {
    return (
      <div id="evidence-intake" className="scroll-mt-28 lg:scroll-mt-24">
        <EvidenceCameraCapture
          caseRecord={selectedCase}
          onCancel={closeCapture}
          onCapture={handleScanSelected}
        />
      </div>
    );
  }

  if (scanFile) {
    return (
      <div id="evidence-intake" className="scroll-mt-28 lg:scroll-mt-24">
        <EvidenceScanReview
          caseRecord={selectedCase}
          file={scanFile}
          onCancel={closeCapture}
          onConfirm={(preparedFile) => {
            enqueueFiles([preparedFile], "camera");
            closeCapture();
          }}
          onRetake={openCamera}
        />
      </div>
    );
  }

  return (
    <div id="evidence-intake" className="grid scroll-mt-28 gap-5 lg:scroll-mt-24">
      {!readOnly ? (
        <>
          <EvidenceSourcePicker
            onFilesSelected={enqueueFiles}
            onGmailRequested={() => openProviderImport("GMAIL")}
            onGoogleDriveRequested={() => openProviderImport("GOOGLE_DRIVE")}
            onScanRequested={openCamera}
            trustedSourcesOnly={portfolioDemo}
          />
          <EvidenceUploadQueue
            activeUploadId={activeUploadId}
            items={uploadQueueItems}
            onClearFinished={clearFinished}
            onRemove={removeUpload}
            onRetry={retryUpload}
          />
        </>
      ) : (
        <p className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-muted-foreground">
          Viewer access is read-only. You can inspect the evidence already saved to this case.
        </p>
      )}

      {notice ? <EvidenceNoticeMessage notice={notice} /> : null}

      <EvidenceRecentImports
        documents={documents}
        isLoading={isLoading}
        isVaultOpen={isVaultOpen}
        onOpenDocument={openVault}
        onViewAll={() => {
          if (isVaultOpen) {
            setIsVaultOpen(false);
          } else {
            openVault();
          }
        }}
      />

      {isVaultOpen ? (
        <section
          aria-labelledby="evidence-library-heading"
          className="scroll-mt-28 rounded-md border border-border bg-card p-4 sm:p-5 lg:scroll-mt-24"
          id="evidence-vault"
        >
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 id="evidence-library-heading" className="text-base font-semibold">
                Evidence library
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {readOnly
                  ? "Search and inspect case evidence."
                  : "Search, inspect, reprocess, and remove case evidence."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{formatFileCount(documents.length)}</Badge>
              {attentionDocumentCount ? (
                <Badge variant="warning">{attentionDocumentCount} need review</Badge>
              ) : null}
              <Button onClick={() => setIsVaultOpen(false)} size="sm" type="button" variant="ghost">
                Hide
              </Button>
            </div>
          </header>

          <div className="pt-4">
            <EvidenceReviewWorkspace
              documents={documents}
              documentToDelete={documentToDelete}
              isDeleting={isDeleting}
              isDetailLoading={isDetailLoading}
              isLoading={isLoading}
              isReprocessing={isReprocessing}
              onCancelDelete={() => setDocumentToDelete(null)}
              onConfirmDelete={async () => {
                if (documentToDelete) {
                  await deleteDocument(documentToDelete);
                }
              }}
              onRefresh={refreshDocuments}
              onReprocess={handleReprocess}
              onRequestDelete={handleRequestDelete}
              onSelectDocument={setSelectedDocumentId}
              readOnly={readOnly}
              selectedDocument={selectedDocument}
              selectedDocumentId={selectedDocumentId}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Renders evidence notices with semantic status and tone styling. */
function EvidenceNoticeMessage({ notice }: { notice: EvidenceNotice }) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        notice.tone === "success"
          ? "border-teal-400/30 bg-teal-400/10 text-teal-100"
          : null,
        notice.tone === "error" ? "border-red-400/30 bg-red-400/10 text-red-100" : null,
        notice.tone === "info" ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : null
      )}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      {notice.text}
    </p>
  );
}
