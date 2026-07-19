"use client";

import Image from "next/image";
import {
  ArrowRight,
  Camera,
  FileUp,
  FolderOpen,
  Images,
  ScanLine,
  type LucideIcon
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useState
} from "react";
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

type SourceTone = "blue" | "green" | "primary" | "red" | "rose" | "violet";

const sourceToneClassNames: Record<SourceTone, string> = {
  blue: "border-blue-400/30 bg-blue-400/10 text-blue-200",
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  primary: "border-primary/40 bg-primary/10 text-primary",
  red: "border-red-400/30 bg-red-400/10 text-red-200",
  rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-200"
};

export function EvidenceSourcePicker({
  onFilesSelected,
  onScanSelected
}: EvidenceSourcePickerProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>,
    source: EvidenceUploadSource
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    onFilesSelected(files, source);
  }

  function handleScanInput(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (file) {
      onScanSelected(file);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    onFilesSelected(Array.from(event.dataTransfer.files), "files");
  }

  return (
    <section
      aria-labelledby="evidence-sources-heading"
      className={cn(
        "grid gap-3 rounded-md focus-within:outline-none",
        isDragging ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : null
      )}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="evidence-sources-heading" className="text-lg font-semibold text-foreground">
            Choose a source
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Files enter this case through private signed uploads.
          </p>
        </div>
        <Badge variant="secondary">Drag and drop supported</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-3 sm:hidden">
        <SourceOption
          accept=".eml,message/rfc822"
          compact
          description="Add a saved .eml file"
          icon={<IntegrationLogo alt="" src="/integrations/gmail.svg" />}
          multiple
          onChange={(event) => handleFileInput(event, "email")}
          title="Gmail"
          tone="red"
        />
        <SourceOption
          accept={evidenceUploadAccept}
          compact
          description="Choose downloaded files"
          icon={<IntegrationLogo alt="" src="/integrations/google-drive.svg" />}
          multiple
          onChange={(event) => handleFileInput(event, "google-drive")}
          title="Google Drive"
          tone="green"
        />
        <SourceOption
          accept={evidenceUploadAccept}
          compact
          description="Choose downloaded files"
          icon={<IntegrationLogo alt="" src="/integrations/dropbox.svg" />}
          multiple
          onChange={(event) => handleFileInput(event, "dropbox")}
          title="Dropbox"
          tone="blue"
        />
        <SourceOption
          accept="image/png,image/jpeg"
          compact
          description="Select image evidence"
          icon={<SourceIcon icon={Images} />}
          multiple
          onChange={(event) => handleFileInput(event, "photos")}
          title="Photos"
          tone="rose"
        />
        <SourceOption
          accept={evidenceUploadAccept}
          compact
          description="Browse this device"
          icon={<SourceIcon icon={FolderOpen} />}
          multiple
          onChange={(event) => handleFileInput(event, "files")}
          title="Files"
          tone="primary"
        />
        <SourceOption
          accept="image/png,image/jpeg"
          capture="environment"
          compact
          description="Capture a document"
          icon={<SourceIcon icon={Camera} />}
          onChange={handleScanInput}
          title="Camera scan"
          tone="violet"
        />
      </div>

      <div className="hidden gap-3 sm:grid sm:grid-cols-4">
        <SourceOption
          accept={evidenceUploadAccept}
          description="Upload documents, images, PDFs, and spreadsheets."
          icon={<SourceIcon icon={FileUp} />}
          multiple
          onChange={(event) => handleFileInput(event, "files")}
          title="Upload files"
          tone="primary"
        />
        <SourceOption
          accept=".eml,message/rfc822"
          description="Add saved Gmail messages as EML files."
          icon={<IntegrationLogo alt="" src="/integrations/gmail.svg" />}
          multiple
          onChange={(event) => handleFileInput(event, "email")}
          title="Gmail import"
          tone="red"
        />
        <SourceOption
          accept={evidenceUploadAccept}
          description="Choose downloaded Drive files from this device."
          icon={<IntegrationLogo alt="" src="/integrations/google-drive.svg" />}
          multiple
          onChange={(event) => handleFileInput(event, "google-drive")}
          title="Google Drive"
          tone="green"
        />
        <SourceOption
          accept="image/png,image/jpeg"
          capture="environment"
          description="Use your camera to capture and review a document."
          icon={<SourceIcon icon={ScanLine} />}
          onChange={handleScanInput}
          title="Scan document"
          tone="violet"
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Supported: {evidenceFileTypeListLabel}, up to {evidenceMaxUploadSizeLabel} each. Gmail,
        Drive, and Dropbox selections use files available through your device picker.
      </p>
    </section>
  );
}

interface SourceOptionProps {
  accept: string;
  capture?: InputHTMLAttributes<HTMLInputElement>["capture"];
  compact?: boolean;
  description: string;
  icon: ReactNode;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  title: string;
  tone: SourceTone;
}

function SourceOption({
  accept,
  capture,
  compact = false,
  description,
  icon,
  multiple = false,
  onChange,
  title,
  tone
}: SourceOptionProps) {
  return (
    <label
      className={cn(
        "group grid cursor-pointer grid-rows-[auto_1fr_auto] border border-border bg-card transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-primary/55 hover:bg-secondary/30",
        compact ? "min-h-40 gap-2 rounded-md p-3" : "min-h-56 gap-4 rounded-md p-4"
      )}
    >
      <input
        accept={accept}
        capture={capture}
        className="sr-only"
        multiple={multiple}
        onChange={onChange}
        type="file"
      />
      <span
        className={cn(
          "flex items-center justify-center rounded-md border",
          compact ? "h-11 w-11" : "h-16 w-16",
          sourceToneClassNames[tone]
        )}
      >
        {icon}
      </span>
      <span className="self-end">
        <span
          className={cn(
            "block break-words font-semibold text-foreground",
            compact ? "text-xs leading-4" : "text-base"
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "mt-1 block text-muted-foreground",
            compact ? "text-[11px] leading-4" : "text-sm leading-5"
          )}
        >
          {description}
        </span>
      </span>
      <ArrowRight
        className={cn(
          "text-muted-foreground transition-colors group-hover:text-primary",
          compact ? "h-4 w-4 justify-self-end" : "h-5 w-5"
        )}
        aria-hidden="true"
      />
    </label>
  );
}

function IntegrationLogo({ alt, src }: { alt: string; src: string }) {
  return <Image alt={alt} className="h-9 w-9 object-contain" height={36} src={src} width={36} />;
}

function SourceIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="h-7 w-7" aria-hidden="true" />;
}
