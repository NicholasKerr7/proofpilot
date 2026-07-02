"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord, CreateDocumentResponse, EvidenceDocument } from "@/lib/client/types";

const maxUploadBytes = 25 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);

interface EvidencePanelProps {
  selectedCase: CaseRecord;
  onDocumentsChanged: () => Promise<void>;
}

export function EvidencePanel({ selectedCase, onDocumentsChanged }: EvidencePanelProps) {
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      setIsLoading(true);
      setMessage(null);

      try {
        const nextDocuments = await apiRequest<EvidenceDocument[]>(
          `/api/cases/${selectedCase.id}/documents`
        );

        if (isMounted) {
          setDocuments(nextDocuments);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Evidence could not be loaded.");
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!allowedMimeTypes.has(file.type)) {
      setMessage("Unsupported file type. Upload PDF, PNG, JPG, JPEG, or TXT.");
      return;
    }

    if (file.size > maxUploadBytes) {
      setMessage("File is too large. Upload evidence under 25 MB.");
      return;
    }

    setIsUploading(true);
    setMessage(null);

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

      const uploadResponse = await fetch(createdDocument.upload.url, {
        body: file,
        headers: createdDocument.upload.headers,
        method: createdDocument.upload.method
      });

      if (!uploadResponse.ok) {
        throw new Error("Signed upload failed. Check storage service configuration.");
      }

      await apiRequest(`/api/documents/${createdDocument.document.id}/complete`, {
        method: "POST"
      });
      await refreshDocuments();
      await onDocumentsChanged();
      setMessage("Evidence uploaded and processing was queued.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    setMessage(null);

    try {
      await apiRequest(`/api/documents/${documentId}`, {
        method: "DELETE"
      });
      await refreshDocuments();
      await onDocumentsChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence could not be deleted.");
    }
  }

  async function refreshDocuments() {
    const nextDocuments = await apiRequest<EvidenceDocument[]>(
      `/api/cases/${selectedCase.id}/documents`
    );
    setDocuments(nextDocuments);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence intake</CardTitle>
        <CardDescription>Upload private support files for this case.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <label className="grid min-h-44 cursor-pointer place-items-center rounded-lg border border-dashed border-primary/45 bg-primary/10 p-5 text-center focus-within:ring-2 focus-within:ring-ring">
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
              {isUploading ? "Uploading evidence..." : "Choose an evidence file"}
            </span>
            <span className="mt-2 block text-sm leading-6 text-muted-foreground">
              PDF, PNG, JPG, JPEG, or TXT under 25 MB.
            </span>
          </span>
        </label>

        {message ? (
          <p className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            {message}
          </p>
        ) : null}

        <div className="grid gap-2 text-sm">
          {isLoading ? <p className="text-muted-foreground">Loading evidence...</p> : null}
          {!isLoading && documents.length === 0 ? (
            <p className="rounded-md border border-border bg-secondary/45 px-3 py-2 text-muted-foreground">
              No evidence uploaded yet.
            </p>
          ) : null}
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/45 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{document.originalName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatBytes(document.byteSize)}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant={document.status === "FAILED" ? "danger" : "secondary"}>
                  {formatStatus(document.status)}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${document.originalName}`}
                  onClick={() => handleDelete(document.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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
