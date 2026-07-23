"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  analyzeCaseChecklist,
  analyzeCaseTimeline,
  fetchDocumentDetail,
  fetchProcessingStatus,
  isActiveProcessingStatus,
  shouldAnalyzeChecklistAfterProcessing
} from "@/components/app/evidence/evidence-panel-utils";
import type { EvidenceNotice } from "@/components/app/evidence/evidence-panel-types";
import type {
  EvidenceDocument,
  EvidenceDocumentDetail
} from "@/lib/client/types";

interface UseSelectedEvidenceProcessingInput {
  caseId: string;
  onDocumentsChanged: () => Promise<void>;
  readOnly: boolean;
  selectedDocumentId: string | null;
  selectedDocumentStatus: string | null | undefined;
  setDocuments: Dispatch<SetStateAction<EvidenceDocument[]>>;
  setNotice: Dispatch<SetStateAction<EvidenceNotice | null>>;
  setSelectedDocument: Dispatch<SetStateAction<EvidenceDocumentDetail | null>>;
  syncQueueDocumentStatus: (documentId: string, status: string) => void;
}

/** Polls the selected evidence record until processing reaches a terminal state. */
export function useSelectedEvidenceProcessing({
  caseId,
  onDocumentsChanged,
  readOnly,
  selectedDocumentId,
  selectedDocumentStatus,
  setDocuments,
  setNotice,
  setSelectedDocument,
  syncQueueDocumentStatus
}: UseSelectedEvidenceProcessingInput) {
  useEffect(() => {
    if (!selectedDocumentId || !isActiveProcessingStatus(selectedDocumentStatus)) {
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
    caseId,
    onDocumentsChanged,
    readOnly,
    selectedDocumentId,
    selectedDocumentStatus,
    setDocuments,
    setNotice,
    setSelectedDocument,
    syncQueueDocumentStatus
  ]);
}
