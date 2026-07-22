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
  onGmailRequested: () => void;
  onGoogleDriveRequested: () => void;
  onScanRequested: () => void;
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
  onGmailRequested,
  onGoogleDriveRequested,
  onScanRequested
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
          <h2
            id="evidence-sources-heading"
            className="scroll-mt-28 text-lg font-semibold text-foreground lg:scroll-mt-24"
            tabIndex={-1}
          >
            Choose a source
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Files enter this case through private signed uploads.
          </p>
        </div>
        <Badge variant="secondary">Drag and drop supported</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-3 sm:hidden">
        <SourceAction
          compact
          description="Browse connected inbox"
          icon={<IntegrationLogo alt="" src="/integrations/gmail.svg" />}
          onClick={onGmailRequested}
          title="Gmail"
          tone="red"
        />
        <SourceAction
          compact
          description="Browse connected Drive"
          icon={<IntegrationLogo alt="" src="/integrations/google-drive.svg" />}
          onClick={onGoogleDriveRequested}
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
        <SourceAction
          compact
          description="Capture a document"
          icon={<SourceIcon icon={Camera} />}
          onClick={onScanRequested}
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
        <SourceAction
          description="Browse connected messages and select case evidence."
          icon={<IntegrationLogo alt="" src="/integrations/gmail.svg" />}
          onClick={onGmailRequested}
          title="Gmail import"
          tone="red"
        />
        <SourceAction
          description="Search connected Drive files and attach selections."
          icon={<IntegrationLogo alt="" src="/integrations/google-drive.svg" />}
          onClick={onGoogleDriveRequested}
          title="Google Drive"
          tone="green"
        />
        <SourceAction
          description="Use your camera to capture and review a document."
          icon={<SourceIcon icon={ScanLine} />}
          onClick={onScanRequested}
          title="Scan document"
          tone="violet"
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Supported: {evidenceFileTypeListLabel}, up to {evidenceMaxUploadSizeLabel} each. Connected
        Gmail and Drive demo sources import only the items you select.
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

interface SourceActionProps {
  compact?: boolean;
  description: string;
  icon: ReactNode;
  onClick: () => void;
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

function SourceAction({
  compact = false,
  description,
  icon,
  onClick,
  title,
  tone
}: SourceActionProps) {
  return (
    <button
      className={cn(
        "group grid cursor-pointer grid-rows-[auto_1fr_auto] border border-border bg-card text-left transition-colors hover:border-primary/55 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "min-h-40 gap-2 rounded-md p-3" : "min-h-56 gap-4 rounded-md p-4"
      )}
      onClick={onClick}
      type="button"
    >
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
    </button>
  );
}

function IntegrationLogo({ alt, src }: { alt: string; src: string }) {
  return <Image alt={alt} className="h-9 w-9 object-contain" height={36} src={src} width={36} />;
}

function SourceIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="h-7 w-7" aria-hidden="true" />;
}
