"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, FolderOpen, Plus } from "lucide-react";
import { EvidenceImportHero } from "@/components/app/evidence/evidence-import-hero";
import { EvidencePanel } from "@/components/app/evidence/evidence-panel";
import type { EvidenceCaptureState } from "@/components/app/evidence/evidence-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseRecord } from "@/lib/client/types";

interface EvidenceUploadViewProps {
  confirmBeforeDelete: boolean;
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onCreateCase: () => void;
  onViewCases: () => void;
  portfolioDemo: boolean;
  selectedCase: CaseRecord | null;
}

export function EvidenceUploadView({
  confirmBeforeDelete,
  onCaseChanged,
  onCreateCase,
  onViewCases,
  portfolioDemo,
  selectedCase
}: EvidenceUploadViewProps) {
  const [captureState, setCaptureState] = useState<EvidenceCaptureState>("idle");
  const selectedCaseId = selectedCase?.id ?? null;
  const handleDocumentsChanged = useCallback(async () => {
    if (selectedCaseId) {
      await onCaseChanged(selectedCaseId);
    }
  }, [onCaseChanged, selectedCaseId]);

  if (!selectedCase) {
    return (
      <section aria-labelledby="upload-view-heading" className="grid gap-5">
        <div className="proof-page-header">
          <p className="text-sm font-semibold text-primary">Evidence intake</p>
          <h1 id="upload-view-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
            Import evidence
          </h1>
        </div>
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-6 text-center">
            <div className="max-w-sm">
              <FolderOpen className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold">Create or select a case first</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Evidence is always stored inside a private case workspace.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button onClick={onViewCases} type="button" variant="outline">
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  Cases
                </Button>
                <Button onClick={onCreateCase} type="button">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New case
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const readOnly = selectedCase.access?.canEdit === false;

  return (
    <section aria-labelledby="upload-view-heading" className="grid gap-5">
      {captureState === "idle" ? (
        <header className="proof-page-header order-1 flex items-start gap-3 sm:order-2">
          <Button
            aria-label="Back to cases"
            className="shrink-0 sm:hidden"
            onClick={onViewCases}
            size="icon"
            title="Back to cases"
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div>
            <h1
              id="upload-view-heading"
              className="text-2xl font-semibold leading-8 sm:text-3xl"
            >
              {readOnly ? "Case evidence" : "Import evidence"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {readOnly
                ? "Review the files and extracted details shared with you."
                : "Bring files, emails, and documents into your case."}
            </p>
          </div>
        </header>
      ) : null}

      {captureState === "idle" ? (
        <div className="order-2 sm:order-1">
          <EvidenceImportHero caseRecord={selectedCase} />
        </div>
      ) : null}

      <div className={captureState === "idle" ? "order-3" : "order-1"}>
        <EvidencePanel
          confirmBeforeDelete={confirmBeforeDelete}
          key={selectedCase.id}
          onCaptureStateChange={setCaptureState}
          onDocumentsChanged={handleDocumentsChanged}
          portfolioDemo={portfolioDemo}
          selectedCase={selectedCase}
        />
      </div>
    </section>
  );
}
