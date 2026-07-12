"use client";

import { useCallback } from "react";
import { ArrowLeft, FolderOpen, Plus, UploadCloud } from "lucide-react";
import { EvidencePanel } from "@/components/app/evidence/evidence-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseRecord } from "@/lib/client/types";

interface EvidenceUploadViewProps {
  confirmBeforeDelete: boolean;
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onCreateCase: () => void;
  onViewCases: () => void;
  selectedCase: CaseRecord | null;
}

export function EvidenceUploadView({
  confirmBeforeDelete,
  onCaseChanged,
  onCreateCase,
  onViewCases,
  selectedCase
}: EvidenceUploadViewProps) {
  const selectedCaseId = selectedCase?.id ?? null;
  const handleDocumentsChanged = useCallback(async () => {
    if (selectedCaseId) {
      await onCaseChanged(selectedCaseId);
    }
  }, [onCaseChanged, selectedCaseId]);

  if (!selectedCase) {
    return (
      <section aria-labelledby="upload-view-heading" className="grid gap-5">
        <div>
          <p className="text-sm font-semibold text-primary">Evidence intake</p>
          <h1 id="upload-view-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
            Upload evidence
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

  return (
    <section aria-labelledby="upload-view-heading" className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            aria-label="Back to cases"
            onClick={onViewCases}
            size="icon"
            title="Back to cases"
            type="button"
            variant="outline"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div>
            <p className="text-sm font-semibold text-primary">Evidence intake</p>
            <h1 id="upload-view-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
              Upload evidence
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{selectedCase.title}</p>
          </div>
        </div>
        <Badge variant="secondary">
          <UploadCloud className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {selectedCase.platform}
        </Badge>
      </div>

      <EvidencePanel
        confirmBeforeDelete={confirmBeforeDelete}
        key={selectedCase.id}
        onDocumentsChanged={handleDocumentsChanged}
        selectedCase={selectedCase}
      />
    </section>
  );
}
