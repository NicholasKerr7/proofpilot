"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
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
import {
  analyzeCaseChecklist,
  analyzeCaseTimeline,
  fetchProcessingStatus,
  formatFileCount,
  isActiveProcessingStatus,
  shouldAnalyzeChecklistAfterProcessing,
  toEvidenceSource
} from "@/components/app/evidence/evidence-panel-utils";
import type { EvidenceNotice } from "@/components/app/evidence/evidence-panel-types";
import { apiRequest } from "@/lib/client/api";
import type {
  CreateDocumentResponse,
  EvidenceDocument,
  EvidenceProcessingStatus
} from "@/lib/client/types";

type QueueItemUpdates = Partial<
  Pick<EvidenceUploadQueueItem, "documentId" | "error" | "progress" | "status">
>;

interface UseEvidenceUploadQueueInput {
  caseId: string;
  onDocumentsChanged: () => Promise<void>;
  onDocumentsLoaded: (
    documents: EvidenceDocument[],
    preferredDocumentId?: string
  ) => void;
  onDocumentStatusesChanged: (
    updates: Map<string, EvidenceProcessingStatus>
  ) => void;
  readOnly: boolean;
  selectedDocumentId: string | null;
  setNotice: Dispatch<SetStateAction<EvidenceNotice | null>>;
}

/** Owns sequential upload execution and background status polling for queued evidence. */
export function useEvidenceUploadQueue({
  caseId,
  onDocumentsChanged,
  onDocumentsLoaded,
  onDocumentStatusesChanged,
  readOnly,
  selectedDocumentId,
  setNotice
}: UseEvidenceUploadQueueInput) {
  const [items, setItems] = useState<EvidenceUploadQueueItem[]>([]);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const processingUploadIdRef = useRef<string | null>(null);
  const processingDocumentIdsKey = JSON.stringify(
    items.flatMap((item) =>
      item.status === "processing" &&
      item.documentId &&
      item.documentId !== selectedDocumentId
        ? [item.documentId]
        : []
    )
  );

  const updateItem = useCallback((itemId: string, updates: QueueItemUpdates) => {
    setItems((currentQueue) =>
      currentQueue.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  }, []);

  const syncDocumentStatus = useCallback((documentId: string, documentStatus: string) => {
    const nextStatus = mapDocumentStatusToQueueStatus(documentStatus);

    if (!nextStatus) {
      return;
    }

    setItems((currentQueue) =>
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

  const syncWithDocuments = useCallback((documents: EvidenceDocument[]) => {
    const documentsById = new Map(documents.map((document) => [document.id, document]));

    setItems((currentQueue) =>
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

  const refreshUploadedDocuments = useCallback(
    async (preferredDocumentId?: string) => {
      const documents = await apiRequest<EvidenceDocument[]>(
        `/api/cases/${caseId}/documents`
      );
      syncWithDocuments(documents);
      onDocumentsLoaded(documents, preferredDocumentId);
    },
    [caseId, onDocumentsLoaded, syncWithDocuments]
  );

  const processItem = useCallback(
    async (item: EvidenceUploadQueueItem) => {
      if (processingUploadIdRef.current) {
        return;
      }

      processingUploadIdRef.current = item.id;
      setActiveUploadId(item.id);
      setNotice(null);
      updateItem(item.id, { error: null, progress: 5, status: "preparing" });

      try {
        if (item.documentId) {
          try {
            await apiRequest(`/api/documents/${item.documentId}`, { method: "DELETE" });
          } catch {
            // Failed reservations may already have been removed by backend cleanup.
          }
        }

        const mimeType = getEvidenceUploadMimeType(item.file);

        if (!mimeType) {
          throw new Error("This file type is not supported.");
        }

        const createdDocument = await apiRequest<CreateDocumentResponse>(
          `/api/cases/${caseId}/documents`,
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

        updateItem(item.id, {
          documentId: createdDocument.document.id,
          progress: 12,
          status: "uploading"
        });
        await uploadEvidenceToSignedUrl(item.file, createdDocument, (progress) => {
          updateItem(item.id, {
            progress: Math.min(90, Math.max(12, Math.round(12 + progress * 0.78)))
          });
        });

        updateItem(item.id, { progress: 94 });
        await apiRequest(`/api/documents/${createdDocument.document.id}/complete`, {
          method: "POST"
        });
        updateItem(item.id, { progress: 100, status: "processing" });

        try {
          await refreshUploadedDocuments(createdDocument.document.id);
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
        updateItem(item.id, {
          error: error instanceof Error ? error.message : "Evidence upload failed.",
          status: "failed"
        });
      } finally {
        processingUploadIdRef.current = null;
        setActiveUploadId(null);
      }
    },
    [
      caseId,
      onDocumentsChanged,
      refreshUploadedDocuments,
      setNotice,
      updateItem
    ]
  );

  useEffect(() => {
    if (activeUploadId || processingUploadIdRef.current) {
      return;
    }

    const nextItem = items.find((item) => item.status === "queued");

    if (!nextItem) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void processItem(nextItem);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeUploadId, items, processItem]);

  useEffect(() => {
    const processingDocumentIds = JSON.parse(processingDocumentIdsKey) as string[];

    if (!processingDocumentIds.length) {
      return;
    }

    let isMounted = true;
    let isRefreshing = false;

    async function refreshProcessingStatuses() {
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
        onDocumentStatusesChanged(updatesByDocumentId);
        statusUpdates.forEach((update) => {
          syncDocumentStatus(update.documentId, update.status.status);
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
            analyzeCaseChecklist(caseId),
            analyzeCaseTimeline(caseId)
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

    void refreshProcessingStatuses();
    const intervalId = window.setInterval(() => {
      void refreshProcessingStatuses();
    }, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [
    caseId,
    onDocumentsChanged,
    onDocumentStatusesChanged,
    processingDocumentIdsKey,
    readOnly,
    setNotice,
    syncDocumentStatus
  ]);

  /** Adds validated files to the sequential queue and reports invalid entries. */
  function enqueueFiles(files: File[], source: EvidenceUploadSource) {
    if (!files.length) {
      return;
    }

    const nextItems = files.map((file) => createEvidenceUploadQueueItem(file, source));
    const invalidCount = nextItems.filter((item) => item.status === "failed").length;
    const validCount = files.length - invalidCount;
    setItems((currentQueue) => [...currentQueue, ...nextItems]);
    setNotice({
      tone: invalidCount ? "error" : "info",
      text: invalidCount
        ? `${formatFileCount(validCount)} queued; ${formatFileCount(invalidCount)} ${
            invalidCount === 1 ? "needs" : "need"
          } attention.`
        : `${formatFileCount(files.length)} added to the upload queue.`
    });
  }

  /** Revalidates and requeues a failed upload item. */
  function retry(itemId: string) {
    const item = items.find((queueItem) => queueItem.id === itemId);

    if (!item) {
      return;
    }

    const validationError = getEvidenceFileValidationError(item.file);

    if (validationError) {
      setNotice({ tone: "error", text: validationError });
      return;
    }

    updateItem(itemId, { error: null, progress: 0, status: "queued" });
  }

  const clearFinished = useCallback(() => {
    setItems((currentQueue) =>
      currentQueue.filter((item) => !isFinishedQueueStatus(item.status))
    );
  }, []);

  const remove = useCallback((itemId: string) => {
    setItems((currentQueue) => currentQueue.filter((item) => item.id !== itemId));
  }, []);

  const reset = useCallback(() => {
    setItems([]);
  }, []);

  return {
    activeUploadId,
    clearFinished,
    enqueueFiles,
    items,
    remove,
    reset,
    retry,
    syncDocumentStatus,
    syncWithDocuments
  };
}
