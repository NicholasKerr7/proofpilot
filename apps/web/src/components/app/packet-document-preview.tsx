"use client";

import { useState } from "react";
import { ExternalLink, Eye, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CasePacketExport } from "@/lib/client/types";

interface PacketDocumentPreviewProps {
  packetExport: CasePacketExport;
}

export function PacketDocumentPreview({ packetExport }: PacketDocumentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section aria-labelledby="packet-preview-heading" className="border-y border-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 id="packet-preview-heading" className="text-sm font-semibold text-foreground">
              Latest packet PDF
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatPacketManifest(packetExport)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-expanded={isOpen}
            aria-controls="packet-preview-frame"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
            {isOpen ? "Close preview" : "Preview PDF"}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={packetExport.previewUrl} rel="noreferrer" target="_blank">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open PDF
            </a>
          </Button>
        </div>
      </div>

      {isOpen ? (
        <div
          className="mt-4 h-[28rem] overflow-hidden rounded-md border border-border bg-secondary/30 md:h-[40rem]"
          id="packet-preview-frame"
        >
          <iframe
            className="h-full w-full bg-white"
            loading="lazy"
            src={packetExport.previewUrl}
            title="Latest ProofPilot packet PDF preview"
          />
        </div>
      ) : null}
    </section>
  );
}

function formatPacketManifest(packetExport: CasePacketExport) {
  const parts = [
    typeof packetExport.pageCount === "number"
      ? `${packetExport.pageCount} ${packetExport.pageCount === 1 ? "page" : "pages"}`
      : null,
    `${packetExport.includedDocumentCount} of ${packetExport.indexedDocumentCount} supporting files included`,
    typeof packetExport.byteSize === "number" ? formatBytes(packetExport.byteSize) : null
  ].filter((part): part is string => Boolean(part));

  return parts.join(" | ");
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
