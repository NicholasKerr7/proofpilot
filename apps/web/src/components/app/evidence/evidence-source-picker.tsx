"use client";

import { type ChangeEvent, type DragEvent, useState } from "react";
import { Mail, PlugZap, ScanLine, UploadCloud } from "lucide-react";
import {
  evidenceFileTypeListLabel,
  evidenceMaxUploadSizeLabel,
  evidenceUploadAccept
} from "@proofpilot/types/evidence";
import { Badge } from "@/components/ui/badge";
import type { EvidenceUploadSource } from "@/components/app/evidence/evidence-upload-utils";
import { cn } from "@/lib/utils";

interface EvidenceSourcePickerProps {
  onFilesSelected: (files: File[], source: EvidenceUploadSource) => void;
  onScanSelected: (file: File) => void;
}

export function EvidenceSourcePicker({
  onFilesSelected,
  onScanSelected
}: EvidenceSourcePickerProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    onFilesSelected(files, "files");
  }

  function handleEmailInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    onFilesSelected(files, "email");
  }

  function handleScanInput(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (file) {
      onScanSelected(file);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    onFilesSelected(Array.from(event.dataTransfer.files), "files");
  }

  return (
    <section aria-labelledby="evidence-sources-heading" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 id="evidence-sources-heading" className="text-sm font-semibold text-foreground">
            Import evidence
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Bring supported files, email exports, and camera images into this case.
          </p>
        </div>
        <Badge variant="secondary">Private signed uploads</Badge>
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-2 rounded-md border border-dashed border-border p-2 md:grid-cols-4",
          isDragging ? "border-primary bg-primary/10" : null
        )}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <label className="grid min-h-36 cursor-pointer content-between gap-3 rounded-md border border-primary/35 bg-primary/10 p-3 focus-within:ring-2 focus-within:ring-ring hover:bg-primary/15">
          <input
            accept={evidenceUploadAccept}
            className="sr-only"
            multiple
            onChange={handleFileInput}
            type="file"
          />
          <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-background/35 text-primary">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Upload files</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Select several documents at once.
            </span>
          </span>
        </label>

        <label className="grid min-h-36 cursor-pointer content-between gap-3 rounded-md border border-border bg-secondary/25 p-3 focus-within:ring-2 focus-within:ring-ring hover:bg-secondary/45">
          <input
            accept=".eml,message/rfc822"
            className="sr-only"
            multiple
            onChange={handleEmailInput}
            type="file"
          />
          <span className="flex h-11 w-11 items-center justify-center rounded-md border border-sky-400/25 bg-sky-400/10 text-sky-200">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Email exports</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Add saved EML messages.
            </span>
          </span>
        </label>

        <label className="grid min-h-36 cursor-pointer content-between gap-3 rounded-md border border-border bg-secondary/25 p-3 focus-within:ring-2 focus-within:ring-ring hover:bg-secondary/45">
          <input
            accept="image/png,image/jpeg"
            capture="environment"
            className="sr-only"
            onChange={handleScanInput}
            type="file"
          />
          <span className="flex h-11 w-11 items-center justify-center rounded-md border border-violet-400/25 bg-violet-400/10 text-violet-200">
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">Scan document</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Capture and review an image.
            </span>
          </span>
        </label>

        <div
          aria-disabled="true"
          className="grid min-h-36 content-between gap-3 rounded-md border border-border bg-secondary/15 p-3 opacity-70"
          title="Connect Gmail or Google Drive before importing from connected apps"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-md border border-teal-400/20 bg-teal-400/10 text-teal-200">
            <PlugZap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Connected apps</span>
              <Badge variant="secondary">Not connected</Badge>
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              Gmail and Drive come after account connection.
            </span>
          </span>
        </div>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Drag and drop anywhere in this import area. Supported: {evidenceFileTypeListLabel}, up
        to {evidenceMaxUploadSizeLabel} each.
      </p>
    </section>
  );
}
