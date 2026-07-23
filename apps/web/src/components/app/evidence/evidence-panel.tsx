"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderImportProvider, ProviderImportResponse } from "@proofpilot/types";
import { Badge } from "@/components/ui/badge";
import { EvidenceCameraCapture } from "@/components/app/evidence/evidence-camera-capture";
import { EvidenceRecentImports } from "@/components/app/evidence/evidence-recent-imports";
import { EvidenceReviewWorkspace } from "@/components/app/evidence/evidence-review-workspace";
import { EvidenceScanReview } from "@/components/app/evidence/evidence-scan-review";
import { EvidenceSourcePicker } from "@/components/app/evidence/evidence-source-picker";
import { EvidenceUploadQueue } from "@/components/app/evidence/evidence-upload-queue";
import { ProviderImportWorkspace } from "@/components/app/evidence/provider-import-workspace";
import {
  createEvidenceUploadQueueItem,
  getEvidenceFileValidationError,
  getEvidenceUploadMimeType,
  isFinishedQueueStatus,
  mapDocumentStatusToQueueStatus,
  uploadEvidenceToSignedUrl,
  type EvidenceUploadQueueItem,
  type EvidenceUploadSource
} from "@/components/app/evidence/evidence-upload-utils";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";
import type {
  CaseRecord,
  CreateDocumentResponse,
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

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

type QueueItemUpdates = Partial<
  Pick<EvidenceUploadQueueItem, "documentId" | "error" | "progress" | "status">
>;

function fetchDocumentDetail(documentId: string) {
  return apiRequest<EvidenceDocumentDetail>(`/api/documents/${documentId}`);
}

function fetchProcessingStatus(documentId: string) {
  return apiRequest<EvidenceProcessingStatus>(`/api/documents/${documentId}/processing-status`);
}

function analyzeCaseChecklist(caseId: string) {
  return apiRequest(`/api/cases/${caseId}/checklist/analyze`, {
    method: "POST"
  });
}

function analyzeCaseTimeline(caseId: string) {
  return apiRequest(`/api/cases/${caseId}/timeline/analyze`, {
    method: "POST"
  });
}

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
  const [uploadQueue, setUploadQueue] = useState<EvidenceUploadQueueItem[]>([]);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderImportProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const processingUploadIdRef = useRef<string | null>(null);
  const processingQueueDocumentIdsKey = JSON.stringify(
    uploadQueue.flatMap((item) =>
      item.status === "processing" &&
      item.documentId &&
      item.documentId !== selectedDocumentId
        ? [item.documentId]
        : []
    )
  );

  const updateQueueItem = useCallback((itemId: string, updates: QueueItemUpdates) => {
    setUploadQueue((currentQueue) =>
      currentQueue.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  }, []);

  const syncQueueDocumentStatus = useCallback((documentId: string, documentStatus: string) => {
    const nextStatus = mapDocumentStatusToQueueStatus(documentStatus);

    if (!nextStatus) {
      return;
    }

    setUploadQueue((currentQueue) =>
      currentQueue.map((item) => {
        if (item.documentId !== documentId || item.status !== "processing") {
          return item;
        }

        return {
          ...item,
          error: nextStatus === "failed" ? "Document processing failed." : item.error,
          status: nextStatus
        };
      })
    );
  }, []);

  const syncQueueWithDocuments = useCallback((nextDocuments: EvidenceDocument[]) => {
    const documentsById = new Map(nextDocuments.map((document) => [document.id, document]));

    setUploadQueue((currentQueue) =>
      currentQueue.map((item) => {
        if (!item.documentId || item.status !== "processing") {
          return item;
        }

        const document = documentsById.get(item.documentId);
        const nextStatus = document ? mapDocumentStatusToQueueStatus(document.status) : null;

        if (!nextStatus || nextStatus === item.status) {
          return item;
        }

        return {
          ...item,
          error: nextStatus === "failed" ? "Document processing failed." : item.error,
          status: nextStatus
        };
      })
    );
  }, []);

  const refreshDocuments = useCallback(
    async (preferredDocumentId?: string) => {
      const nextDocuments = await apiRequest<EvidenceDocument[]>(
        `/api/cases/${selectedCase.id}/documents`
      );
      setDocuments(nextDocuments);
      syncQueueWithDocuments(nextDocuments);
      setSelectedDocumentId((currentId) => {
        const targetId = preferredDocumentId ?? currentId;

        if (targetId && nextDocuments.some((document) => document.id === targetId)) {
          return targetId;
        }

        return nextDocuments[0]?.id ?? null;
      });
    },
    [selectedCase.id, syncQueueWithDocuments]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      setIsLoading(true);
      setNotice(null);
      setSelectedDocument(null);
      setSelectedDocumentId(null);
      setUploadQueue([]);
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
  }, [onCaptureStateChange, selectedCase.id]);

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

  useEffect(() => {
    if (!selectedDocumentId || !isActiveProcessingStatus(selectedDocument?.status)) {
      return;
    }

    let isMounted = true;
    let isRefreshing = false;
    let isSettled = false;

    async function refreshProcessingStatus() {
      if (!selectedDocumentId || isRefreshing || isSettled) {
        return;
      }

      isRefreshing = true;

      try {
        const statusUpdate = await fetchProcessingStatus(selectedDocumentId);

        if (!isMounted) {
          return;
        }

        setDocuments((currentDocuments) =>
          currentDocuments.map((document) =>
            document.id === selectedDocumentId
              ? { ...document, status: statusUpdate.status, updatedAt: statusUpdate.updatedAt }
              : document
          )
        );
        syncQueueDocumentStatus(selectedDocumentId, statusUpdate.status);

        if (isActiveProcessingStatus(statusUpdate.status)) {
          setSelectedDocument((currentDocument) =>
            currentDocument?.id === selectedDocumentId
              ? {
                  ...currentDocument,
                  status: statusUpdate.status,
                  updatedAt: statusUpdate.updatedAt,
                  processingLogs: statusUpdate.processingLogs
                }
              : currentDocument
          );
          return;
        }

        isSettled = true;
        const detail = await fetchDocumentDetail(selectedDocumentId);

        if (!isMounted) {
          return;
        }

        setSelectedDocument(detail);
        setDocuments((currentDocuments) =>
          currentDocuments.map((document) =>
            document.id === selectedDocumentId
              ? { ...document, status: detail.status, updatedAt: detail.updatedAt }
              : document
          )
        );
        syncQueueDocumentStatus(selectedDocumentId, detail.status);

        try {
          if (!readOnly && shouldAnalyzeChecklistAfterProcessing(detail.status)) {
            await Promise.all([
              analyzeCaseChecklist(selectedCase.id),
              analyzeCaseTimeline(selectedCase.id)
            ]);
          }

          await onDocumentsChanged();
        } catch (error) {
          if (isMounted) {
            setNotice({
              tone: "error",
              text:
                error instanceof Error
                  ? error.message
                  : "Document processed, but case intelligence could not be refreshed."
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          isSettled = true;
          setNotice({
            tone: "error",
            text:
              error instanceof Error
                ? error.message
                : "Document processing status could not be refreshed."
          });
        }
      } finally {
        isRefreshing = false;
      }
    }

    void refreshProcessingStatus();
    const intervalId = window.setInterval(() => {
      void refreshProcessingStatus();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [
    onDocumentsChanged,
    readOnly,
    selectedCase.id,
    selectedDocument?.status,
    selectedDocumentId,
    syncQueueDocumentStatus
  ]);

  useEffect(() => {
    const processingDocumentIds = JSON.parse(processingQueueDocumentIdsKey) as string[];

    if (!processingDocumentIds.length) {
      return;
    }

    let isMounted = true;
    let isRefreshing = false;

    async function refreshQueueProcessingStatuses() {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;

      try {
        const statusUpdates = (
          await Promise.all(
            processingDocumentIds.map(async (documentId) => {
              try {
                return {
                  documentId,
                  status: await fetchProcessingStatus(documentId)
                };
              } catch {
                return null;
              }
            })
          )
        ).filter((update): update is NonNullable<typeof update> => Boolean(update));

        if (!isMounted || !statusUpdates.length) {
          return;
        }

        const updatesByDocumentId = new Map(
          statusUpdates.map((update) => [update.documentId, update.status])
        );
        setDocuments((currentDocuments) =>
          currentDocuments.map((document) => {
            const statusUpdate = updatesByDocumentId.get(document.id);

            return statusUpdate
              ? {
                  ...document,
                  status: statusUpdate.status,
                  updatedAt: statusUpdate.updatedAt
                }
              : document;
          })
        );

        statusUpdates.forEach((update) => {
          syncQueueDocumentStatus(update.documentId, update.status.status);
        });

        const settledUpdates = statusUpdates.filter(
          (update) => !isActiveProcessingStatus(update.status.status)
        );

        if (!settledUpdates.length) {
          return;
        }

        if (
          !readOnly &&
          settledUpdates.some((update) =>
            shouldAnalyzeChecklistAfterProcessing(update.status.status)
          )
        ) {
          await Promise.all([
            analyzeCaseChecklist(selectedCase.id),
            analyzeCaseTimeline(selectedCase.id)
          ]);
        }

        await onDocumentsChanged();
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text:
              error instanceof Error
                ? error.message
                : "Evidence processed, but case intelligence could not be refreshed."
          });
        }
      } finally {
        isRefreshing = false;
      }
    }

    void refreshQueueProcessingStatuses();
    const intervalId = window.setInterval(() => {
      void refreshQueueProcessingStatuses();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [
    onDocumentsChanged,
    processingQueueDocumentIdsKey,
    readOnly,
    selectedCase.id,
    syncQueueDocumentStatus
  ]);

  const processQueueItem = useCallback(
    async (item: EvidenceUploadQueueItem) => {
      if (processingUploadIdRef.current) {
        return;
      }

      processingUploadIdRef.current = item.id;
      setActiveUploadId(item.id);
      setNotice(null);
      updateQueueItem(item.id, { error: null, progress: 5, status: "preparing" });

      try {
        if (item.documentId) {
          try {
            await apiRequest(`/api/documents/${item.documentId}`, { method: "DELETE" });
          } catch {
            // A failed upload may already have been removed by the backend.
          }
        }

        const mimeType = getEvidenceUploadMimeType(item.file);

        if (!mimeType) {
          throw new Error("This file type is not supported.");
        }

        const createdDocument = await apiRequest<CreateDocumentResponse>(
          `/api/cases/${selectedCase.id}/documents`,
          {
            body: JSON.stringify({
              originalName: item.file.name,
              mimeType,
              byteSize: item.file.size,
              source: toEvidenceSource(item.source)
            }),
            method: "POST"
          }
        );

        updateQueueItem(item.id, {
          documentId: createdDocument.document.id,
          progress: 12,
          status: "uploading"
        });
        await uploadEvidenceToSignedUrl(item.file, createdDocument, (progress) => {
          updateQueueItem(item.id, {
            progress: Math.min(90, Math.max(12, Math.round(12 + progress * 0.78)))
          });
        });

        updateQueueItem(item.id, { progress: 94 });
        await apiRequest(`/api/documents/${createdDocument.document.id}/complete`, {
          method: "POST"
        });
        updateQueueItem(item.id, { progress: 100, status: "processing" });

        try {
          await refreshDocuments(createdDocument.document.id);
          await onDocumentsChanged();
          setNotice({
            tone: "success",
            text: `${item.file.name} uploaded and entered background processing.`
          });
        } catch (error) {
          setNotice({
            tone: "error",
            text:
              error instanceof Error
                ? `Upload completed. ${error.message}`
                : "Upload completed, but the evidence vault could not be refreshed."
          });
        }
      } catch (error) {
        updateQueueItem(item.id, {
          error: error instanceof Error ? error.message : "Evidence upload failed.",
          status: "failed"
        });
      } finally {
        processingUploadIdRef.current = null;
        setActiveUploadId(null);
      }
    },
    [onDocumentsChanged, refreshDocuments, selectedCase.id, updateQueueItem]
  );

  useEffect(() => {
    if (activeUploadId || processingUploadIdRef.current) {
      return;
    }

    const nextItem = uploadQueue.find((item) => item.status === "queued");

    if (!nextItem) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void processQueueItem(nextItem);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeUploadId, processQueueItem, uploadQueue]);

  function enqueueFiles(files: File[], source: EvidenceUploadSource) {
    if (!files.length) {
      return;
    }

    const nextItems = files.map((file) => createEvidenceUploadQueueItem(file, source));
    const invalidCount = nextItems.filter((item) => item.status === "failed").length;
    const validCount = files.length - invalidCount;
    setUploadQueue((currentQueue) => [...currentQueue, ...nextItems]);
    setNotice({
      tone: invalidCount ? "error" : "info",
      text: invalidCount
        ? `${formatFileCount(validCount)} queued; ${formatFileCount(invalidCount)} ${
            invalidCount === 1 ? "needs" : "need"
          } attention.`
        : `${formatFileCount(files.length)} added to the upload queue.`
    });
  }

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

  function openCamera() {
    setNotice(null);
    setScanFile(null);
    setIsCameraOpen(true);
    onCaptureStateChange("camera");
    focusEvidenceSurface("camera-capture-heading", "page");
  }

  function openProviderImport(provider: ProviderImportProvider) {
    setNotice(null);
    setActiveProvider(provider);
    onCaptureStateChange(provider === "GMAIL" ? "gmail" : "google-drive");
    focusEvidenceSurface("provider-import-heading", "page");
  }

  function closeProviderImport() {
    setActiveProvider(null);
    onCaptureStateChange("idle");
    focusEvidenceSurface("evidence-sources-heading", "element");
  }

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

  function closeCapture() {
    setScanFile(null);
    setIsCameraOpen(false);
    onCaptureStateChange("idle");
    focusEvidenceSurface("evidence-sources-heading", "element");
  }

  function handleRetryUpload(itemId: string) {
    const item = uploadQueue.find((queueItem) => queueItem.id === itemId);

    if (!item) {
      return;
    }

    const validationError = getEvidenceFileValidationError(item.file);

    if (validationError) {
      setNotice({ tone: "error", text: validationError });
      return;
    }

    updateQueueItem(itemId, { error: null, progress: 0, status: "queued" });
  }

  async function handleReprocess() {
    if (!selectedDocument) {
      return;
    }

    setIsReprocessing(true);
    setNotice({ tone: "info", text: "Queueing document reprocessing..." });

    try {
      await apiRequest<ReprocessDocumentResponse>(
        `/api/documents/${selectedDocument.id}/reprocess`,
        {
          method: "POST"
        }
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

  async function confirmDelete() {
    if (!documentToDelete) {
      return;
    }

    await deleteDocument(documentToDelete);
  }

  async function deleteDocument(document: EvidenceDocument) {
    setIsDeleting(true);
    setNotice(null);

    try {
      await apiRequest(`/api/documents/${document.id}`, {
        method: "DELETE"
      });
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

  function handleRequestDelete(document: EvidenceDocument) {
    if (confirmBeforeDelete) {
      setDocumentToDelete(document);
      return;
    }

    void deleteDocument(document);
  }

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

  function toggleVault() {
    if (isVaultOpen) {
      setIsVaultOpen(false);
      return;
    }

    openVault();
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
            items={uploadQueue}
            onClearFinished={() =>
              setUploadQueue((currentQueue) =>
                currentQueue.filter((item) => !isFinishedQueueStatus(item.status))
              )
            }
            onRemove={(itemId) =>
              setUploadQueue((currentQueue) =>
                currentQueue.filter((item) => item.id !== itemId)
              )
            }
            onRetry={handleRetryUpload}
          />
        </>
      ) : (
        <p className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-muted-foreground">
          Viewer access is read-only. You can inspect the evidence already saved to this case.
        </p>
      )}

      {notice ? (
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
      ) : null}

      <EvidenceRecentImports
        documents={documents}
        isLoading={isLoading}
        isVaultOpen={isVaultOpen}
        onOpenDocument={openVault}
        onViewAll={toggleVault}
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
              onConfirmDelete={confirmDelete}
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

function toEvidenceSource(source: EvidenceUploadSource) {
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

function isActiveProcessingStatus(status: string | null | undefined) {
  return status === "UPLOADED" || status === "PROCESSING";
}

function shouldAnalyzeChecklistAfterProcessing(status: string) {
  return status === "PROCESSED" || status === "NEEDS_REVIEW";
}

function formatFileCount(count: number) {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

function getEvidenceScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reduceMotion === "true"
    ? "auto"
    : "smooth";
}

function focusEvidenceSurface(elementId: string, scrollTarget: "element" | "page") {
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
