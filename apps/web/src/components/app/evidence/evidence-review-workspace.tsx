"use client";

import { useState } from "react";
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  Mail,
  RefreshCcw,
  Search,
  Trash2
} from "lucide-react";
import { EvidenceDeleteConfirmation } from "@/components/app/evidence/evidence-delete-confirmation";
import { EvidenceDocumentDetailPanel } from "@/components/app/evidence/evidence-document-detail";
import {
  formatEvidenceBytes,
  formatEvidenceMimeType,
  formatEvidenceStatus,
  getEvidenceStatusVariant
} from "@/components/app/evidence/evidence-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EvidenceDocument, EvidenceDocumentDetail } from "@/lib/client/types";
import { cn } from "@/lib/utils";

const evidenceFilters = [
  { label: "All", value: "all" },
  { label: "Documents", value: "documents" },
  { label: "Images", value: "images" },
  { label: "Data", value: "data" }
] as const;

type EvidenceFilter = (typeof evidenceFilters)[number]["value"];

interface EvidenceReviewWorkspaceProps {
  documents: EvidenceDocument[];
  documentToDelete: EvidenceDocument | null;
  isDeleting: boolean;
  isDetailLoading: boolean;
  isLoading: boolean;
  isReprocessing: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onReprocess: () => Promise<void>;
  onRequestDelete: (document: EvidenceDocument) => void;
  onSelectDocument: (documentId: string) => void;
  selectedDocument: EvidenceDocumentDetail | null;
  selectedDocumentId: string | null;
}

export function EvidenceReviewWorkspace({
  documents,
  documentToDelete,
  isDeleting,
  isDetailLoading,
  isLoading,
  isReprocessing,
  onCancelDelete,
  onConfirmDelete,
  onRefresh,
  onReprocess,
  onRequestDelete,
  onSelectDocument,
  selectedDocument,
  selectedDocumentId
}: EvidenceReviewWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredDocuments = documents.filter(
    (document) =>
      matchesEvidenceFilter(document.mimeType, filter) &&
      (!normalizedQuery || document.originalName.toLowerCase().includes(normalizedQuery))
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search evidence"
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search evidence by file name"
            type="search"
            value={query}
          />
        </div>
        <div
          aria-label="Filter evidence by type"
          className="flex gap-1 overflow-x-auto rounded-md border border-border bg-secondary/35 p-1 scroll-container"
          role="group"
        >
          {evidenceFilters.map((item) => (
            <Button
              key={item.value}
              aria-pressed={filter === item.value}
              className="shrink-0"
              onClick={() => setFilter(item.value)}
              size="sm"
              type="button"
              variant={filter === item.value ? "secondary" : "ghost"}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <section aria-labelledby="evidence-vault-heading" className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4
                id="evidence-vault-heading"
                className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
              >
                Evidence vault
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredDocuments.length} of {documents.length} files
              </p>
            </div>
            <Button
              aria-label="Refresh evidence"
              onClick={() => {
                void onRefresh();
              }}
              size="icon"
              title="Refresh evidence"
              type="button"
              variant="ghost"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-2 grid gap-2 md:max-h-[52rem] md:overflow-y-auto md:pr-1 scroll-container">
            {isLoading ? (
              <p className="rounded-md border border-border bg-secondary/35 px-3 py-3 text-sm text-muted-foreground">
                Loading evidence...
              </p>
            ) : null}
            {!isLoading && documents.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-secondary/35 px-3 py-3 text-sm text-muted-foreground">
                No evidence uploaded yet.
              </p>
            ) : null}
            {!isLoading && documents.length > 0 && filteredDocuments.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-secondary/35 px-3 py-3 text-sm text-muted-foreground">
                No evidence matches this search and filter.
              </p>
            ) : null}
            {filteredDocuments.map((document) => (
              <EvidenceListItem
                key={document.id}
                document={document}
                isDeleting={isDeleting}
                isPendingDelete={documentToDelete?.id === document.id}
                isSelected={selectedDocumentId === document.id}
                onCancelDelete={onCancelDelete}
                onConfirmDelete={onConfirmDelete}
                onRequestDelete={onRequestDelete}
                onSelectDocument={onSelectDocument}
              />
            ))}
          </div>
        </section>

        <EvidenceDocumentDetailPanel
          documentToDelete={documentToDelete}
          isDeleting={isDeleting}
          isDetailLoading={isDetailLoading}
          isReprocessing={isReprocessing}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          onReprocess={onReprocess}
          onRequestDelete={onRequestDelete}
          selectedDocument={selectedDocument}
        />
      </div>
    </div>
  );
}

interface EvidenceListItemProps {
  document: EvidenceDocument;
  isDeleting: boolean;
  isPendingDelete: boolean;
  isSelected: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onRequestDelete: (document: EvidenceDocument) => void;
  onSelectDocument: (documentId: string) => void;
}

function EvidenceListItem({
  document,
  isDeleting,
  isPendingDelete,
  isSelected,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onSelectDocument
}: EvidenceListItemProps) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-md border border-border bg-secondary/35 p-2",
        isSelected ? "border-primary/55 bg-primary/10" : null
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <button
          aria-pressed={isSelected}
          className="grid min-h-14 min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelectDocument(document.id)}
          type="button"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-background/55 text-primary">
            <DocumentTypeIcon mimeType={document.mimeType} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {document.originalName}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatEvidenceMimeType(document.mimeType)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatEvidenceBytes(document.byteSize)}</span>
            </span>
            <Badge className="mt-2" variant={getEvidenceStatusVariant(document.status)}>
              {formatEvidenceStatus(document.status)}
            </Badge>
          </span>
        </button>
        <Button
          aria-label={`Delete ${document.originalName}`}
          onClick={() => onRequestDelete(document)}
          size="icon"
          title={`Delete ${document.originalName}`}
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {isPendingDelete ? (
        <EvidenceDeleteConfirmation
          isDeleting={isDeleting}
          message="Delete this evidence file?"
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      ) : null}
    </div>
  );
}

function matchesEvidenceFilter(mimeType: string, filter: EvidenceFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "images") {
    return mimeType.startsWith("image/");
  }

  if (filter === "data") {
    return (
      mimeType === "text/csv" ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  }

  return !mimeType.startsWith("image/") && !matchesEvidenceFilter(mimeType, "data");
}

function DocumentTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5" aria-hidden="true" />;
  }

  if (matchesEvidenceFilter(mimeType, "data")) {
    return <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />;
  }

  if (mimeType === "message/rfc822") {
    return <Mail className="h-5 w-5" aria-hidden="true" />;
  }

  return <FileText className="h-5 w-5" aria-hidden="true" />;
}
