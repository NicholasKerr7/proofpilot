"use client";

import { Download, ExternalLink, FileText, RefreshCcw, Trash2 } from "lucide-react";
import { EvidenceDeleteConfirmation } from "@/components/app/evidence/evidence-delete-confirmation";
import {
  formatEvidenceBytes,
  formatEvidenceDateTime,
  formatEvidenceMimeType,
  formatEvidenceStatus,
  getEvidenceStatusVariant,
  isEvidenceProcessing
} from "@/components/app/evidence/evidence-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvidenceDocument, EvidenceDocumentDetail } from "@/lib/client/types";

const previewMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);

interface EvidenceDocumentDetailPanelProps {
  documentToDelete: EvidenceDocument | null;
  isDeleting: boolean;
  isDetailLoading: boolean;
  isReprocessing: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onReprocess: () => Promise<void>;
  onRequestDelete: (document: EvidenceDocument) => void;
  selectedDocument: EvidenceDocumentDetail | null;
}

export function EvidenceDocumentDetailPanel({
  documentToDelete,
  isDeleting,
  isDetailLoading,
  isReprocessing,
  onCancelDelete,
  onConfirmDelete,
  onReprocess,
  onRequestDelete,
  selectedDocument
}: EvidenceDocumentDetailPanelProps) {
  if (isDetailLoading) {
    return (
      <aside className="rounded-md border border-border bg-secondary/30 p-4">
        <p className="text-sm text-muted-foreground">Loading document detail...</p>
      </aside>
    );
  }

  if (!selectedDocument) {
    return (
      <aside className="grid min-h-48 place-items-center rounded-md border border-dashed border-border bg-secondary/30 p-4 text-center">
        <div>
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted-foreground">Select evidence to review details.</p>
        </div>
      </aside>
    );
  }

  const canPreview = previewMimeTypes.has(selectedDocument.mimeType);
  const isProcessing = isEvidenceProcessing(selectedDocument.status);
  const isPendingDelete = documentToDelete?.id === selectedDocument.id;

  return (
    <aside
      aria-labelledby="document-detail-heading"
      className="min-w-0 self-start rounded-md border border-border bg-secondary/30 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Document detail
          </p>
          <h4 id="document-detail-heading" className="mt-1 break-words text-base font-semibold">
            {selectedDocument.originalName}
          </h4>
        </div>
        <Badge variant={getEvidenceStatusVariant(selectedDocument.status)}>
          {formatEvidenceStatus(selectedDocument.status)}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-3 text-xs">
        <Metadata label="Type" value={formatEvidenceMimeType(selectedDocument.mimeType)} />
        <Metadata label="File size" value={formatEvidenceBytes(selectedDocument.byteSize)} />
        <Metadata label="Added" value={formatEvidenceDateTime(selectedDocument.createdAt)} />
        <Metadata label="Entities" value={String(selectedDocument.entities.length)} />
      </dl>

      {isProcessing ? (
        <p className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          Processing evidence. Results will appear here shortly.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild size="sm" variant="outline">
          <a href={selectedDocument.downloadUrl} rel="noreferrer" target="_blank">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open file
          </a>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <a download href={selectedDocument.downloadUrl}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download
          </a>
        </Button>
        <Button
          disabled={isReprocessing || isProcessing}
          onClick={() => {
            void onReprocess();
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          {isReprocessing ? "Queueing..." : "Reprocess"}
        </Button>
        <Button
          onClick={() => onRequestDelete(selectedDocument)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </Button>
      </div>

      {isPendingDelete ? (
        <div className="mt-3">
          <EvidenceDeleteConfirmation
            isDeleting={isDeleting}
            message="Delete this evidence file and its stored object?"
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
          />
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-md border border-border bg-background/60">
        {canPreview ? (
          <iframe
            className="h-64 w-full bg-background md:h-72"
            src={selectedDocument.downloadUrl}
            title={`Preview ${selectedDocument.originalName}`}
          />
        ) : (
          <div className="grid h-64 place-items-center px-4 text-center text-sm text-muted-foreground md:h-72">
            Preview is not available for this file type.
          </div>
        )}
      </div>

      <section aria-labelledby="document-extracted-text-heading" className="mt-4 grid gap-2">
        <h5
          id="document-extracted-text-heading"
          className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
        >
          Extracted text
        </h5>
        <div className="max-h-44 overflow-auto rounded-md border border-border bg-background/55 p-3 text-sm leading-6 text-muted-foreground scroll-container">
          {selectedDocument.extractedText || "No extracted text yet."}
        </div>
      </section>

      <section aria-labelledby="document-entities-heading" className="mt-4 grid gap-2">
        <h5
          id="document-entities-heading"
          className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
        >
          Extracted entities
        </h5>
        <div className="flex flex-wrap gap-2">
          {selectedDocument.entities.length ? (
            selectedDocument.entities.map((entity) => (
              <Badge key={entity.id} variant="secondary">
                {entity.type}: {entity.value}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No entities detected yet.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="document-activity-heading" className="mt-4 grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h5
            id="document-activity-heading"
            className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
          >
            Processing activity
          </h5>
          {selectedDocument.processingLogs.length > 4 ? (
            <span className="text-xs text-muted-foreground">
              Latest 4 of {selectedDocument.processingLogs.length}
            </span>
          ) : null}
        </div>
        <div className="grid gap-2">
          {selectedDocument.processingLogs.length ? (
            selectedDocument.processingLogs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="rounded-md border border-border bg-background/55 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{formatEvidenceStatus(log.step)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatEvidenceDateTime(log.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {formatEvidenceStatus(log.status)}
                  {log.message ? ` · ${log.message}` : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No processing activity yet.</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}
