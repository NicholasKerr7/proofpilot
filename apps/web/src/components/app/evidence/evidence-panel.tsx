"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import {
  evidenceFileTypeListLabel,
  evidenceMaxUploadByteSize,
  evidenceMaxUploadSizeLabel,
  evidenceUploadAccept,
  inferEvidenceMimeTypeFromName,
  isEvidenceMimeType
} from "@proofpilot/types/evidence";
import { Badge } from "@/components/ui/badge";
import { EvidenceReviewWorkspace } from "@/components/app/evidence/evidence-review-workspace";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  selectedCase: CaseRecord;
  onDocumentsChanged: () => Promise<void>;
}

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

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

export function EvidencePanel({ selectedCase, onDocumentsChanged }: EvidencePanelProps) {
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<EvidenceDocumentDetail | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<EvidenceDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      setIsLoading(true);
      setNotice(null);
      setSelectedDocument(null);
      setSelectedDocumentId(null);

      try {
        const nextDocuments = await apiRequest<EvidenceDocument[]>(
          `/api/cases/${selectedCase.id}/documents`
        );

        if (isMounted) {
          setDocuments(nextDocuments);
          setSelectedDocumentId(nextDocuments[0]?.id ?? null);
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
  }, [selectedCase.id]);

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

        try {
          if (shouldAnalyzeChecklistAfterProcessing(detail.status)) {
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
  }, [onDocumentsChanged, selectedCase.id, selectedDocument?.status, selectedDocumentId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";
    await uploadFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    if (!isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const [file] = Array.from(event.dataTransfer.files ?? []);
    await uploadFile(file);
  }

  async function uploadFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const mimeType = getUploadMimeType(file);

    if (!mimeType) {
      setNotice({
        tone: "error",
        text: `Unsupported file type. Upload ${evidenceFileTypeListLabel}.`
      });
      return;
    }

    if (file.size > evidenceMaxUploadByteSize) {
      setNotice({
        tone: "error",
        text: `File is too large. Upload evidence under ${evidenceMaxUploadSizeLabel}.`
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setNotice({ tone: "info", text: "Preparing signed upload..." });

    try {
      const createdDocument = await apiRequest<CreateDocumentResponse>(
        `/api/cases/${selectedCase.id}/documents`,
        {
          body: JSON.stringify({
            originalName: file.name,
            mimeType,
            byteSize: file.size
          }),
          method: "POST"
        }
      );

      setUploadProgress(12);
      await uploadToSignedUrl(file, createdDocument, (progress) => {
        setUploadProgress(Math.min(90, Math.max(12, Math.round(12 + progress * 0.78))));
      });

      setUploadProgress(94);
      await apiRequest(`/api/documents/${createdDocument.document.id}/complete`, {
        method: "POST"
      });
      setUploadProgress(100);
      await refreshDocuments(createdDocument.document.id);
      await onDocumentsChanged();
      setNotice({ tone: "success", text: "Evidence uploaded and processing was queued." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Evidence upload failed."
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
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

    setIsDeleting(true);
    setNotice(null);

    try {
      await apiRequest(`/api/documents/${documentToDelete.id}`, {
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

  async function refreshDocuments(preferredDocumentId?: string) {
    const nextDocuments = await apiRequest<EvidenceDocument[]>(
      `/api/cases/${selectedCase.id}/documents`
    );
    setDocuments(nextDocuments);
    setSelectedDocumentId((currentId) => {
      const targetId = preferredDocumentId ?? currentId;

      if (targetId && nextDocuments.some((document) => document.id === targetId)) {
        return targetId;
      }

      return nextDocuments[0]?.id ?? null;
    });
  }

  const attentionDocumentCount = documents.filter(
    (document) => document.status === "FAILED" || document.status === "NEEDS_REVIEW"
  ).length;

  return (
    <Card id="evidence-intake" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div>
          <CardTitle>Evidence intake</CardTitle>
          <CardDescription>Upload, search, and review private support files.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{documents.length} files</Badge>
          {attentionDocumentCount ? (
            <Badge variant="warning">{attentionDocumentCount} need review</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label
          className={cn(
            "grid min-h-40 cursor-pointer place-items-center gap-3 rounded-lg border border-dashed border-primary/45 bg-primary/10 p-5 text-center focus-within:ring-2 focus-within:ring-ring md:min-h-28 md:grid-cols-[auto_minmax(0,1fr)_auto] md:place-items-stretch md:items-center md:text-left",
            isDragging ? "border-primary bg-primary/20" : null,
            isUploading ? "cursor-wait opacity-80" : null
          )}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            className="sr-only"
            type="file"
            accept={evidenceUploadAccept}
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/20 text-primary">
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">
              {isUploading ? "Uploading evidence..." : "Choose or drop an evidence file"}
            </span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              {evidenceFileTypeListLabel} under 25 MB.
            </span>
          </span>
          <span className="hidden text-right text-xs leading-5 text-muted-foreground md:block">
            Private signed upload
            <br />
            Processing starts automatically
          </span>
        </label>

        {uploadProgress !== null ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Upload progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <progress
              className="proof-progress"
              value={uploadProgress}
              max={100}
              aria-label="Upload progress"
            >
              {uploadProgress}%
            </progress>
          </div>
        ) : null}

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
          onRequestDelete={setDocumentToDelete}
          onSelectDocument={setSelectedDocumentId}
          selectedDocument={selectedDocument}
          selectedDocumentId={selectedDocumentId}
        />
      </CardContent>
    </Card>
  );
}

function uploadToSignedUrl(
  file: File,
  createdDocument: CreateDocumentResponse,
  onProgress: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(createdDocument.upload.method, createdDocument.upload.url);

    Object.entries(createdDocument.upload.headers).forEach(([header, value]) => {
      request.setRequestHeader(header, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      reject(new Error("Signed upload failed. Check storage service configuration."));
    };
    request.onerror = () => reject(new Error("Signed upload failed. Check storage service configuration."));
    request.send(file);
  });
}

function isActiveProcessingStatus(status: string | null | undefined) {
  return status === "UPLOADED" || status === "PROCESSING";
}

function shouldAnalyzeChecklistAfterProcessing(status: string) {
  return status === "PROCESSED" || status === "NEEDS_REVIEW";
}

function getUploadMimeType(file: File) {
  if (isEvidenceMimeType(file.type)) {
    return file.type;
  }

  return inferEvidenceMimeTypeFromName(file.name);
}
