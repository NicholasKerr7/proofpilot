"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProviderImportResponse } from "@proofpilot/types";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileCheck2,
  IdCard,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { EvidenceImportHero } from "@/components/app/evidence/evidence-import-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

interface PassportDemoWorkspaceProps {
  caseRecord: CaseRecord;
  onBack: () => void;
  onImported: (response: ProviderImportResponse) => Promise<void>;
}

type PassportDemoStage = "scan" | "review";

const syntheticPassportItemId = "drive-identity-verification";

export function PassportDemoWorkspace({
  caseRecord,
  onBack,
  onImported
}: PassportDemoWorkspaceProps) {
  const [stage, setStage] = useState<PassportDemoStage>("scan");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeStage(nextStage: PassportDemoStage) {
    setError(null);
    setStage(nextStage);
    window.requestAnimationFrame(() => {
      document.getElementById("passport-demo-heading")?.focus();
    });
  }

  async function savePassportToCase() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await apiRequest<ProviderImportResponse>(
        `/api/cases/${caseRecord.id}/provider-imports/GOOGLE_DRIVE`,
        {
          body: JSON.stringify({ itemIds: [syntheticPassportItemId] }),
          method: "POST"
        }
      );
      await onImported(response);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The sample passport could not be saved."
      );
      setIsSaving(false);
    }
  }

  return (
    <section aria-labelledby="passport-demo-heading" className="grid gap-5">
      <header className="proof-page-header flex items-start gap-3">
        <Button
          aria-label="Back to evidence sources"
          className="shrink-0"
          disabled={isSaving}
          onClick={onBack}
          size="icon"
          title="Back to evidence sources"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-primary">Guided evidence capture</p>
            <Badge variant="secondary">Synthetic sample</Badge>
          </div>
          <h1
            className="mt-1 scroll-mt-28 text-2xl font-semibold leading-8 sm:text-3xl"
            id="passport-demo-heading"
            tabIndex={-1}
          >
            {stage === "scan" ? "Scan passport" : "Review passport"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {stage === "scan"
              ? "Capture a prepared sample document without sharing a real identity document."
              : "Confirm the sample extraction and link it to the case requirement."}
          </p>
        </div>
      </header>

      <EvidenceImportHero caseRecord={caseRecord} />

      {stage === "scan" ? (
        <PassportScanStage onCapture={() => changeStage("review")} />
      ) : (
        <PassportReviewStage
          error={error}
          isSaving={isSaving}
          onRetake={() => changeStage("scan")}
          onSave={() => {
            void savePassportToCase();
          }}
        />
      )}
    </section>
  );
}

function PassportScanStage({ onCapture }: { onCapture: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Align sample document</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The document is already positioned and ready to capture.
          </p>
        </div>
        <Badge variant="success">
          <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
          Ready
        </Badge>
      </div>

      <div className="proof-card-surface overflow-hidden rounded-md border">
        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          <Image
            alt="Synthetic passport positioned inside a document scan frame"
            className="object-contain"
            fill
            priority
            sizes="(min-width: 1024px) 72rem, 100vw"
            src="/brand/proofpilot-passport-scan-frame.webp"
          />
        </div>

        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            This is generated demonstration data. No real passport or camera feed is used.
          </p>
          <Button className="w-full sm:w-auto" onClick={onCapture} type="button">
            <Camera className="h-4 w-4" aria-hidden="true" />
            Capture sample
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PassportReviewStageProps {
  error: string | null;
  isSaving: boolean;
  onRetake: () => void;
  onSave: () => void;
}

function PassportReviewStage({
  error,
  isSaving,
  onRetake,
  onSave
}: PassportReviewStageProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] lg:items-start">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Detected document</h2>
          <Badge variant="success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Document detected
          </Badge>
        </div>

        <div className="proof-card-surface relative aspect-[4/3] overflow-hidden rounded-md border">
          <Image
            alt="Synthetic United States passport identity page for Nicholas James Kerr"
            className="object-contain"
            fill
            priority
            sizes="(min-width: 1024px) 64vw, 100vw"
            src="/brand/proofpilot-passport-identity-page.webp"
          />
        </div>
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-24">
        <section className="proof-card-surface rounded-md border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Sample extraction</h2>
            <Badge variant="secondary">98% confidence</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Full name</dt>
              <dd className="mt-1 font-medium text-foreground">Nicholas James Kerr</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Document</dt>
              <dd className="mt-1 font-medium text-foreground">Passport</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Country</dt>
              <dd className="mt-1 font-medium text-foreground">United States</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Expiration</dt>
              <dd className="mt-1 font-medium text-foreground">May 18, 2030</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <IdCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            All names, numbers, dates, and imagery in this sample are fictional demonstration data.
          </p>
        </section>

        <section className="proof-accent-frame rounded-md border p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-teal-400/30 bg-teal-400/10 text-teal-200">
              <FileCheck2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Linked requirement</p>
              <h2 className="mt-1 text-sm font-semibold">Proof of identity</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ready to enter private storage and background processing.
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <p
            className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button disabled={isSaving} onClick={onRetake} type="button" variant="outline">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retake
          </Button>
          <Button disabled={isSaving} onClick={onSave} type="button">
            {isSaving ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
            )}
            {isSaving ? "Saving..." : "Save to case"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
