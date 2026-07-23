"use client";

import {
  ArrowRight,
  FileImage,
  FileSpreadsheet,
  FileText,
  Inbox,
  Mail
} from "lucide-react";
import {
  formatEvidenceBytes,
  formatEvidenceDateTime,
  formatEvidenceMimeType,
  formatEvidenceSource,
  formatEvidenceStatus,
  getEvidenceStatusVariant
} from "@/components/app/evidence/evidence-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvidenceDocument } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface EvidenceRecentImportsProps {
  documents: EvidenceDocument[];
  isLoading: boolean;
  isVaultOpen: boolean;
  onOpenDocument: (documentId: string) => void;
  onViewAll: () => void;
}

export function EvidenceRecentImports({
  documents,
  isLoading,
  isVaultOpen,
  onOpenDocument,
  onViewAll
}: EvidenceRecentImportsProps) {
  const recentDocuments = [...documents]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 3);

  return (
    <section
      aria-labelledby="recent-imports-heading"
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="recent-imports-heading" className="text-base font-semibold text-primary">
            Recent imports
          </h2>
          {documents.length ? <Badge variant="secondary">{documents.length}</Badge> : null}
        </div>
        <Button
          disabled={isLoading || documents.length === 0}
          onClick={onViewAll}
          size="sm"
          type="button"
          variant="ghost"
        >
          {isVaultOpen ? "Hide vault" : "View all"}
        </Button>
      </header>

      <div className="border-t border-border">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground" role="status">
            Loading recent imports...
          </p>
        ) : null}

        {!isLoading && recentDocuments.length === 0 ? (
          <div className="grid min-h-28 place-items-center px-4 py-6 text-center">
            <div>
              <Inbox className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-foreground">No imports yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                New evidence will appear here after upload.
              </p>
            </div>
          </div>
        ) : null}

        {recentDocuments.map((document) => (
          <button
            aria-label={`Review ${document.originalName}`}
            className="group grid w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[3.25rem_minmax(0,1fr)_auto_2rem] sm:px-5"
            key={document.id}
            onClick={() => onOpenDocument(document.id)}
            type="button"
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-md border",
                getDocumentIconClassName(document.mimeType)
              )}
            >
              <DocumentIcon mimeType={document.mimeType} />
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {document.originalName}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{formatEvidenceMimeType(document.mimeType)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatEvidenceBytes(document.byteSize)}</span>
                <span aria-hidden="true">·</span>
                <span>{formatEvidenceSource(document.source)}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground sm:hidden">
                {formatEvidenceDateTime(document.createdAt)}
              </span>
            </span>

            <span className="grid justify-items-end gap-1.5">
              <Badge variant={getEvidenceStatusVariant(document.status)}>
                {getRecentStatusLabel(document.status)}
              </Badge>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {formatEvidenceDateTime(document.createdAt)}
              </span>
            </span>

            <ArrowRight
              className="hidden h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary sm:block"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </section>
  );
}

function getRecentStatusLabel(status: string) {
  if (status === "NEEDS_REVIEW") {
    return "Review";
  }

  if (status === "UPLOADED" || status === "PROCESSING") {
    return "Processing";
  }

  return formatEvidenceStatus(status);
}

function DocumentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5" aria-hidden="true" />;
  }

  if (
    mimeType === "text/csv" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />;
  }

  if (mimeType === "message/rfc822") {
    return <Mail className="h-5 w-5" aria-hidden="true" />;
  }

  return <FileText className="h-5 w-5" aria-hidden="true" />;
}

function getDocumentIconClassName(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }

  if (mimeType === "application/pdf") {
    return "border-red-400/25 bg-red-400/10 text-red-200";
  }

  if (mimeType === "message/rfc822") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  return "border-primary/25 bg-primary/10 text-primary";
}
