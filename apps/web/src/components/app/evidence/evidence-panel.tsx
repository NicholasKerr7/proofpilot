"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  RefreshCcw,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const maxUploadBytes = 25 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);
const previewMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);

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

    if (!allowedMimeTypes.has(file.type)) {
      setNotice({
        tone: "error",
        text: "Unsupported file type. Upload PDF, PNG, JPG, JPEG, or TXT."
      });
      return;
    }

    if (file.size > maxUploadBytes) {
      setNotice({ tone: "error", text: "File is too large. Upload evidence under 25 MB." });
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
            mimeType: file.type,
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

  const canPreviewSelectedDocument = selectedDocument
    ? previewMimeTypes.has(selectedDocument.mimeType)
    : false;
  const isSelectedDocumentProcessing = isActiveProcessingStatus(selectedDocument?.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence intake</CardTitle>
        <CardDescription>Upload, review, and manage private support files.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label
          className={cn(
            "grid min-h-44 cursor-pointer place-items-center rounded-lg border border-dashed border-primary/45 bg-primary/10 p-5 text-center focus-within:ring-2 focus-within:ring-ring",
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
            accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <span>
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/20 text-primary">
              <UploadCloud className="h-6 w-6" />
            </span>
            <span className="block font-semibold">
              {isUploading ? "Uploading evidence..." : "Choose or drop an evidence file"}
            </span>
            <span className="mt-2 block text-sm leading-6 text-muted-foreground">
              PDF, PNG, JPG, JPEG, or TXT under 25 MB.
            </span>
          </span>
        </label>

        {uploadProgress !== null ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Upload progress</span>
              <span>{uploadProgress}%</span>
            </div>
            <progress className="proof-progress" value={uploadProgress} max={100}>
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
          >
            {notice.text}
          </p>
        ) : null}

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Evidence vault</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void refreshDocuments();
                }}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            {isLoading ? <p className="text-muted-foreground">Loading evidence...</p> : null}
            {!isLoading && documents.length === 0 ? (
              <p className="rounded-md border border-border bg-secondary/45 px-3 py-2 text-muted-foreground">
                No evidence uploaded yet.
              </p>
            ) : null}
            {documents.map((document) => {
              const isSelected = document.id === selectedDocumentId;
              const isPendingDelete = documentToDelete?.id === document.id;

              return (
                <div
                  key={document.id}
                  className={cn(
                    "grid gap-2 rounded-md border border-border bg-secondary/45 px-3 py-2",
                    isSelected ? "border-primary/55 bg-primary/10" : null
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{document.originalName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatMimeType(document.mimeType)} · {formatBytes(document.byteSize)}
                        </span>
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={getStatusVariant(document.status)}>
                        {formatStatus(document.status)}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${document.originalName}`}
                        onClick={() => setDocumentToDelete(document)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>

                  {isPendingDelete ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                      <span>Delete this evidence file?</span>
                      <span className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDocumentToDelete(null)}
                          disabled={isDeleting}
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            void confirmDelete();
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="rounded-md border border-border bg-secondary/35 p-3">
            {isDetailLoading ? (
              <p className="text-sm text-muted-foreground">Loading document detail...</p>
            ) : null}

            {!isDetailLoading && !selectedDocument ? (
              <p className="text-sm text-muted-foreground">Select evidence to review details.</p>
            ) : null}

            {!isDetailLoading && selectedDocument ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{selectedDocument.originalName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMimeType(selectedDocument.mimeType)} ·{" "}
                      {formatBytes(selectedDocument.byteSize)} ·{" "}
                      {formatDateTime(selectedDocument.createdAt)}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(selectedDocument.status)}>
                    {formatStatus(selectedDocument.status)}
                  </Badge>
                </div>

                {isSelectedDocumentProcessing ? (
                  <p className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                    Processing evidence. Results will appear here shortly.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={selectedDocument.downloadUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open file
                    </a>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <a href={selectedDocument.downloadUrl} download>
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void handleReprocess();
                    }}
                    disabled={isReprocessing || isSelectedDocumentProcessing}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {isReprocessing ? "Queueing..." : "Reprocess"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDocumentToDelete(selectedDocument)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>

                {documentToDelete?.id === selectedDocument.id ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                    <span>Delete this evidence file and its stored object?</span>
                    <span className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDocumentToDelete(null)}
                        disabled={isDeleting}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void confirmDelete();
                        }}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </Button>
                    </span>
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-md border border-border bg-background/60">
                  {canPreviewSelectedDocument ? (
                    <iframe
                      className="h-80 w-full bg-background"
                      src={selectedDocument.downloadUrl}
                      title={`Preview ${selectedDocument.originalName}`}
                    />
                  ) : (
                    <div className="grid h-80 place-items-center px-4 text-center text-sm text-muted-foreground">
                      Preview is not available for this file type.
                    </div>
                  )}
                </div>

                <section className="grid gap-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Extracted text
                  </p>
                  <div className="max-h-44 overflow-auto rounded-md border border-border bg-background/55 p-3 text-sm leading-6 text-muted-foreground scroll-container">
                    {selectedDocument.extractedText ? (
                      selectedDocument.extractedText
                    ) : (
                      <span>No extracted text yet.</span>
                    )}
                  </div>
                </section>

                <section className="grid gap-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Processing logs
                  </p>
                  <div className="grid gap-2">
                    {selectedDocument.processingLogs.length === 0 ? (
                      <p className="rounded-md border border-border bg-background/55 px-3 py-2 text-sm text-muted-foreground">
                        No processing logs yet.
                      </p>
                    ) : null}
                    {selectedDocument.processingLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-md border border-border bg-background/55 px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{formatStatus(log.step)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatStatus(log.status)}
                          {log.message ? ` · ${log.message}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Entities</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.entities.length === 0 ? (
                      <p className="rounded-md border border-border bg-background/55 px-3 py-2 text-sm text-muted-foreground">
                        No entities detected yet.
                      </p>
                    ) : null}
                    {selectedDocument.entities.map((entity) => (
                      <Badge key={entity.id} variant="secondary">
                        {entity.type}: {entity.value}
                      </Badge>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
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

function formatBytes(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMimeType(mimeType: string) {
  const labels: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "text/plain": "TXT"
  };

  return labels[mimeType] ?? mimeType;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function isActiveProcessingStatus(status: string | null | undefined) {
  return status === "UPLOADED" || status === "PROCESSING";
}

function shouldAnalyzeChecklistAfterProcessing(status: string) {
  return status === "PROCESSED" || status === "NEEDS_REVIEW";
}

function getStatusVariant(status: string) {
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
