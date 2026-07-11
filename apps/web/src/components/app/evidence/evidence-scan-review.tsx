"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, RotateCcw, ShieldCheck, X } from "lucide-react";
import { formatEvidenceBytes } from "@/components/app/evidence/evidence-format";
import { Button } from "@/components/ui/button";

interface EvidenceScanReviewProps {
  file: File;
  onCancel: () => void;
  onConfirm: () => void;
  onReplace: (file: File) => void;
}

export function EvidenceScanReview({
  file,
  onCancel,
  onConfirm,
  onReplace
}: EvidenceScanReviewProps) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        setPreview({ file, url: reader.result });
      }
    });
    reader.readAsDataURL(file);

    return () => {
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
      }
    };
  }, [file]);

  function handleReplacement(event: ChangeEvent<HTMLInputElement>) {
    const [replacement] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (replacement) {
      onReplace(replacement);
    }
  }

  return (
    <section aria-labelledby="scan-review-heading" className="grid gap-4 border-y border-border py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-teal-100">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <h4 id="scan-review-heading" className="text-sm font-semibold">
              Scan ready for review
            </h4>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Confirm the image is readable before adding it to the upload queue.
          </p>
        </div>
        <Button
          aria-label="Close scan review"
          className="shrink-0"
          onClick={onCancel}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.6fr)] md:items-start">
        <div className="relative aspect-[4/3] min-h-56 overflow-hidden rounded-md border border-border bg-background/65">
          {preview?.file === file ? (
            <Image
              alt={`Camera preview of ${file.name}`}
              className="object-contain"
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              src={preview.url}
              unoptimized
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Preparing preview...
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <dl className="grid gap-3 rounded-md border border-border bg-secondary/25 p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">File name</dt>
              <dd className="mt-1 break-words font-medium text-foreground">{file.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">File size</dt>
              <dd className="mt-1 font-medium text-foreground">{formatEvidenceBytes(file.size)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Processing</dt>
              <dd className="mt-1 text-muted-foreground">OCR and entity extraction start after upload.</dd>
            </div>
          </dl>

          <p className="flex gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            The image uses the same private signed-upload flow as every other evidence file.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <label className="cursor-pointer">
                <input
                  accept="image/png,image/jpeg"
                  capture="environment"
                  className="sr-only"
                  onChange={handleReplacement}
                  type="file"
                />
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Retake
              </label>
            </Button>
            <Button onClick={onConfirm} type="button">
              <Camera className="h-4 w-4" aria-hidden="true" />
              Add to queue
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
