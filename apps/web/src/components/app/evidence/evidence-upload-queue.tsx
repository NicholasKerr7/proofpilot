"use client";

import { FileImage, FileText, Mail, RefreshCcw, Trash2, X } from "lucide-react";
import { formatEvidenceBytes } from "@/components/app/evidence/evidence-format";
import {
  isFinishedQueueStatus,
  getEvidenceFileValidationError,
  type EvidenceUploadQueueItem,
  type EvidenceUploadQueueStatus
} from "@/components/app/evidence/evidence-upload-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EvidenceUploadQueueProps {
  activeUploadId: string | null;
  items: EvidenceUploadQueueItem[];
  onClearFinished: () => void;
  onRemove: (itemId: string) => void;
  onRetry: (itemId: string) => void;
}

export function EvidenceUploadQueue({
  activeUploadId,
  items,
  onClearFinished,
  onRemove,
  onRetry
}: EvidenceUploadQueueProps) {
  if (!items.length) {
    return null;
  }

  const uploadedCount = items.filter((item) =>
    item.status === "processing" || item.status === "processed" || item.status === "needs_review"
  ).length;
  const finishedCount = items.filter((item) => isFinishedQueueStatus(item.status)).length;
  const totalBytes = items.reduce((total, item) => total + item.file.size, 0);

  return (
    <section aria-labelledby="upload-queue-heading" className="grid gap-3 border-y border-border py-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 id="upload-queue-heading" className="text-sm font-semibold text-foreground">
              Upload queue
            </h4>
            <Badge variant="secondary">
              {items.length} {items.length === 1 ? "file" : "files"}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Files upload one at a time and enter background processing automatically.
          </p>
        </div>
        {finishedCount ? (
          <Button onClick={onClearFinished} size="sm" type="button" variant="ghost">
            <X className="h-4 w-4" aria-hidden="true" />
            Clear finished
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-secondary/20 p-3 text-center">
        <QueueMetric label="Uploaded" value={`${uploadedCount}/${items.length}`} />
        <QueueMetric label="Total size" value={formatEvidenceBytes(totalBytes)} />
        <QueueMetric
          label="Waiting"
          value={String(items.filter((item) => item.status === "queued").length)}
        />
      </div>

      <div className="grid gap-2" aria-live="polite">
        {items.map((item) => (
          <UploadQueueRow
            key={item.id}
            isActive={activeUploadId === item.id}
            item={item}
            onRemove={onRemove}
            onRetry={onRetry}
          />
        ))}
      </div>
    </section>
  );
}

interface UploadQueueRowProps {
  isActive: boolean;
  item: EvidenceUploadQueueItem;
  onRemove: (itemId: string) => void;
  onRetry: (itemId: string) => void;
}

function UploadQueueRow({ isActive, item, onRemove, onRetry }: UploadQueueRowProps) {
  const canRemove = !isActive && item.status !== "preparing" && item.status !== "uploading";

  return (
    <div className="grid gap-3 rounded-md border border-border bg-secondary/25 p-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(10rem,0.45fr)_auto] md:items-center">
      <span className={getQueueIconClassName(item.status)}>
        <QueueFileIcon item={item} />
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatEvidenceBytes(item.file.size)} · {formatUploadSource(item.source)}
        </p>
        {item.error ? (
          <p className="mt-2 text-xs leading-5 text-red-100" role="alert">
            {item.error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={getQueueStatusVariant(item.status)}>{formatQueueStatus(item.status)}</Badge>
          {item.status === "preparing" || item.status === "uploading" ? (
            <span className="text-xs text-muted-foreground">{item.progress}%</span>
          ) : null}
        </div>
        {item.status === "preparing" || item.status === "uploading" ? (
          <progress
            aria-label={`Upload progress for ${item.file.name}`}
            className="proof-progress"
            max={100}
            value={item.progress}
          >
            {item.progress}%
          </progress>
        ) : null}
      </div>

      <div className="flex justify-end gap-1">
        {item.status === "failed" && !getEvidenceFileValidationError(item.file) ? (
          <Button
            aria-label={`Retry ${item.file.name}`}
            onClick={() => onRetry(item.id)}
            size="icon"
            title={`Retry ${item.file.name}`}
            type="button"
            variant="ghost"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          aria-label={`Remove ${item.file.name} from queue`}
          disabled={!canRemove}
          onClick={() => onRemove(item.id)}
          size="icon"
          title={`Remove ${item.file.name} from queue`}
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function QueueMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-base font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-normal text-muted-foreground">{label}</p>
    </div>
  );
}

function QueueFileIcon({ item }: { item: EvidenceUploadQueueItem }) {
  if (item.source === "email") {
    return <Mail className="h-5 w-5" aria-hidden="true" />;
  }

  if (item.file.type.startsWith("image/")) {
    return <FileImage className="h-5 w-5" aria-hidden="true" />;
  }

  return <FileText className="h-5 w-5" aria-hidden="true" />;
}

function getQueueIconClassName(status: EvidenceUploadQueueStatus) {
  return cn(
    "flex h-11 w-11 items-center justify-center rounded-md border",
    status === "failed"
      ? "border-red-400/25 bg-red-400/10 text-red-100"
      : "border-primary/25 bg-primary/10 text-primary"
  );
}

function getQueueStatusVariant(status: EvidenceUploadQueueStatus) {
  if (status === "processed") {
    return "success" as const;
  }

  if (status === "needs_review") {
    return "warning" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  return "secondary" as const;
}

function formatQueueStatus(status: EvidenceUploadQueueStatus) {
  if (status === "needs_review") {
    return "Needs review";
  }

  if (status === "processed") {
    return "Processed";
  }

  if (status === "processing") {
    return "Processing queued";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatUploadSource(source: EvidenceUploadQueueItem["source"]) {
  if (source === "camera") {
    return "Camera scan";
  }

  if (source === "email") {
    return "Email export";
  }

  return "Device files";
}
