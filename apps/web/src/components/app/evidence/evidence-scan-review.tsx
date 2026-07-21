"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Crop,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  UploadCloud,
  X
} from "lucide-react";
import { formatEvidenceBytes } from "@/components/app/evidence/evidence-format";
import { EvidenceImportHero } from "@/components/app/evidence/evidence-import-hero";
import {
  prepareScanImage,
  type ScanCropInset,
  type ScanRotation
} from "@/components/app/evidence/scan-image-processing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface EvidenceScanReviewProps {
  caseRecord: CaseRecord;
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  onRetake: () => void;
}

const cropOptions = [0, 5, 10, 15] as const satisfies readonly ScanCropInset[];
const rotationClassNames: Record<ScanRotation, string> = {
  0: "rotate-0",
  90: "rotate-90",
  180: "rotate-180",
  270: "-rotate-90"
};
const cropFrameClassNames: Record<ScanCropInset, string> = {
  0: "inset-0",
  5: "inset-[5%]",
  10: "inset-[10%]",
  15: "inset-[15%]"
};

export function EvidenceScanReview({
  caseRecord,
  file,
  onCancel,
  onConfirm,
  onRetake
}: EvidenceScanReviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<ScanRotation>(0);
  const [cropInset, setCropInset] = useState<ScanCropInset>(0);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    const handleLoad = () => {
      if (typeof reader.result === "string") {
        setPreviewUrl(reader.result);
      }
    };
    reader.addEventListener("load", handleLoad);
    reader.readAsDataURL(file);

    return () => {
      reader.removeEventListener("load", handleLoad);
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
      }
    };
  }, [file]);

  function rotate(offset: -90 | 90) {
    setRotation((currentRotation) => {
      const nextRotation = (currentRotation + offset + 360) % 360;
      return nextRotation as ScanRotation;
    });
  }

  async function handleConfirm() {
    setIsPreparing(true);
    setError(null);

    try {
      onConfirm(await prepareScanImage(file, rotation, cropInset));
    } catch (processingError) {
      setError(
        processingError instanceof Error
          ? processingError.message
          : "The scanned image could not be prepared."
      );
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <section aria-labelledby="scan-review-heading" className="grid gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            aria-label="Back to camera"
            className="shrink-0"
            onClick={onRetake}
            size="icon"
            title="Back to camera"
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div>
            <p className="text-sm font-semibold text-primary">Evidence capture</p>
            <h1
              className="mt-1 text-2xl font-semibold sm:text-3xl"
              id="scan-review-heading"
              tabIndex={-1}
            >
              Scan review
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Confirm that the document is readable before its secure upload.
            </p>
          </div>
        </div>
        <Button
          aria-label="Close scan review"
          className="shrink-0"
          onClick={onCancel}
          size="icon"
          title="Close scan review"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      <EvidenceImportHero caseRecord={caseRecord} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-start">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Captured document</h2>
            <Badge variant="success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Image captured
            </Badge>
          </div>

          <div className="relative aspect-[4/3] min-h-64 overflow-hidden rounded-md border border-border bg-black/70">
            {previewUrl ? (
              <Image
                alt={`Scan preview of ${file.name}`}
                className={cn("object-contain transition-transform", rotationClassNames[rotation])}
                fill
                sizes="(min-width: 1024px) 64vw, 100vw"
                src={previewUrl}
                unoptimized
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Preparing preview...
              </div>
            )}
            <span
              className={cn(
                "pointer-events-none absolute rounded-sm border-2 border-primary/80 transition-all",
                cropFrameClassNames[cropInset]
              )}
              aria-hidden="true"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              aria-label="Rotate scan left"
              onClick={() => rotate(-90)}
              title="Rotate left"
              type="button"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Rotate left</span>
            </Button>
            <Button
              aria-expanded={isCropOpen}
              aria-pressed={cropInset > 0}
              onClick={() => setIsCropOpen((currentValue) => !currentValue)}
              type="button"
              variant="outline"
            >
              <Crop className="h-4 w-4" aria-hidden="true" />
              Crop
            </Button>
            <Button
              aria-label="Rotate scan right"
              onClick={() => rotate(90)}
              title="Rotate right"
              type="button"
              variant="outline"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Rotate right</span>
            </Button>
          </div>

          {isCropOpen ? (
            <div className="grid gap-3 rounded-md border border-border bg-secondary/25 p-3">
              <div>
                <p className="text-sm font-semibold">Center crop</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Trim an equal margin from every edge. The orange frame shows the saved area.
                </p>
              </div>
              <div aria-label="Crop margin" className="grid grid-cols-4 gap-2" role="group">
                {cropOptions.map((cropOption) => (
                  <Button
                    key={cropOption}
                    aria-pressed={cropInset === cropOption}
                    onClick={() => setCropInset(cropOption)}
                    size="sm"
                    type="button"
                    variant={cropInset === cropOption ? "secondary" : "ghost"}
                  >
                    {cropOption === 0 ? "None" : `${cropOption}%`}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-24">
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="text-base font-semibold">Ready to process</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Text, dates, and entities are extracted after the image enters background processing.
            </p>
            <dl className="mt-4 grid gap-3 border-y border-border py-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">File name</dt>
                <dd className="mt-1 break-words font-medium text-foreground">{file.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">File size</dt>
                <dd className="mt-1 font-medium text-foreground">{formatEvidenceBytes(file.size)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Edits</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {rotation ? `${rotation} degree rotation` : "Original orientation"}
                  {cropInset ? `, ${cropInset}% center crop` : ""}
                </dd>
              </div>
            </dl>
            <p className="mt-4 flex gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              The image uses the same private signed-upload flow as every evidence file.
            </p>
          </div>

          {error ? (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button disabled={isPreparing} onClick={onRetake} type="button" variant="outline">
              <Camera className="h-4 w-4" aria-hidden="true" />
              Retake
            </Button>
            <Button
              disabled={isPreparing}
              onClick={() => {
                void handleConfirm();
              }}
              type="button"
            >
              {isPreparing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
              )}
              {isPreparing ? "Preparing..." : "Add to queue"}
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
