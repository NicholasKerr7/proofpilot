"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PacketCoverPage } from "@/components/app/packet-cover-page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CasePacketExport, CaseRecord } from "@/lib/client/types";

interface PacketDocumentPreviewProps {
  packetExport: CasePacketExport;
  selectedCase: CaseRecord;
}

const maximumVisiblePageDots = 12;

export function PacketDocumentPreview({
  packetExport,
  selectedCase
}: PacketDocumentPreviewProps) {
  const [activePage, setActivePage] = useState(1);
  const pageCount = Math.max(packetExport.pageCount ?? 1, 1);
  const visiblePages = getVisiblePages(pageCount, activePage);

  function moveToPage(page: number) {
    setActivePage(Math.min(Math.max(page, 1), pageCount));
  }

  function handleReaderKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveToPage(activePage - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveToPage(activePage + 1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveToPage(1);
    }

    if (event.key === "End") {
      event.preventDefault();
      moveToPage(pageCount);
    }
  }

  return (
    <section
      aria-labelledby="packet-preview-heading"
      className="packet-reader mx-auto w-full max-w-[30rem] overflow-hidden rounded-md border"
      onKeyDown={handleReaderKeyDown}
    >
      <header className="flex min-h-13 items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h4
          id="packet-preview-heading"
          className="text-[11px] font-semibold uppercase text-[#ff6b16] sm:text-xs"
        >
          Packet preview ({pageCount} {pageCount === 1 ? "page" : "pages"})
        </h4>
        <p
          aria-live="polite"
          className="shrink-0 text-[11px] text-[#8d969f] sm:text-xs"
        >
          Page {activePage} of {pageCount}
        </p>
      </header>

      <div className="border-t border-white/[0.035] px-2 pb-3 sm:px-4 sm:pb-4">
        <div className="relative mx-auto">
          <Button
            aria-label="Previous packet page"
            className="packet-reader-control absolute left-1 top-1/2 z-30 -translate-y-1/2 rounded-full sm:left-0"
            disabled={activePage === 1}
            onClick={() => moveToPage(activePage - 1)}
            size="icon"
            title="Previous page"
            type="button"
            variant="ghost"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>

          <div className="mx-auto w-[calc(100%-4.5rem)] max-w-[21rem] pb-4 pt-0 sm:w-full sm:pb-5">
            <div className="packet-page-stack relative pb-1 pr-4">
              <span className="packet-page-layer packet-page-layer-back" aria-hidden="true" />
              <span className="packet-page-layer packet-page-layer-middle" aria-hidden="true" />
              <span className="packet-page-layer packet-page-layer-front" aria-hidden="true" />

              {activePage === 1 ? (
                <PacketCoverPage packetExport={packetExport} selectedCase={selectedCase} />
              ) : (
                <iframe
                  className="relative z-10 aspect-[210/297] w-full rounded-md border border-white/10 bg-white"
                  key={activePage}
                  loading="lazy"
                  src={getPdfPageUrl(packetExport.previewUrl, activePage)}
                  title={`ProofPilot packet page ${activePage}`}
                />
              )}
            </div>
          </div>

          <Button
            aria-label="Next packet page"
            className="packet-reader-control absolute right-1 top-1/2 z-30 -translate-y-1/2 rounded-full sm:right-0"
            disabled={activePage === pageCount}
            onClick={() => moveToPage(activePage + 1)}
            size="icon"
            title="Next page"
            type="button"
            variant="ghost"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        <nav
          aria-label="Packet preview pages"
          className="flex min-h-8 items-center justify-center"
        >
          {visiblePages.map((page) => (
            <button
              aria-current={activePage === page ? "page" : undefined}
              aria-label={`Show packet page ${page}`}
              className="group flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a32]"
              key={page}
              onClick={() => moveToPage(page)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full bg-[#4c5257] transition-colors",
                  activePage === page
                    ? "bg-[#ff781f] shadow-[0_0_10px_rgba(255,107,22,0.42)]"
                    : "group-hover:bg-[#737a80]"
                )}
              />
            </button>
          ))}
        </nav>

        <p className="sr-only">{formatPacketManifest(packetExport)}</p>
      </div>
    </section>
  );
}

function getVisiblePages(pageCount: number, activePage: number) {
  const visibleCount = Math.min(pageCount, maximumVisiblePageDots);
  const maximumStart = Math.max(pageCount - visibleCount + 1, 1);
  const desiredStart = activePage - Math.floor(visibleCount / 2);
  const start = Math.min(Math.max(desiredStart, 1), maximumStart);

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function getPdfPageUrl(url: string, page: number) {
  const baseUrl = url.split("#")[0] ?? url;
  return `${baseUrl}#page=${page}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}

function formatPacketManifest(packetExport: CasePacketExport) {
  const parts = [
    `${packetExport.includedDocumentCount} of ${packetExport.indexedDocumentCount} supporting files included`,
    typeof packetExport.byteSize === "number" ? formatBytes(packetExport.byteSize) : null
  ].filter((part): part is string => Boolean(part));

  return parts.join(". ");
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
