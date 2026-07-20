"use client";

import { useEffect, useState } from "react";
import {
  statementGuidanceFields,
  type SaveStatementGuidanceInput
} from "@proofpilot/types";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FileText,
  Lightbulb,
  Paperclip,
  Save,
  WandSparkles,
  type LucideIcon
} from "lucide-react";
import {
  emptyStatementGuidance,
  StatementGuidance
} from "@/components/app/statement/statement-guidance";
import { StatementSummaryPanel } from "@/components/app/statement/statement-summary-panel";
import { StatementVersionHistory } from "@/components/app/statement/statement-version-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import type {
  CaseRecord,
  CaseStatement,
  CaseStatementResponse,
  GeneratedCaseSummary,
  StatementGuidance as StatementGuidanceRecord
} from "@/lib/client/types";

interface StatementBuilderProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  selectedCase: CaseRecord;
}

type Notice = {
  caseId: string;
  tone: "success" | "error" | "info";
  text: string;
};

type WritingTip = {
  description: string;
  icon: LucideIcon;
  title: string;
};

const writingTips: WritingTip[] = [
  {
    description: "Stick to confirmed facts and avoid emotional or accusatory language.",
    icon: Lightbulb,
    title: "Be clear and factual"
  },
  {
    description: "Describe how the account action affects your personal or business activity.",
    icon: Paperclip,
    title: "Explain the impact"
  },
  {
    description: "State the review, reinstatement, or explanation you want from the platform.",
    icon: FileCheck2,
    title: "Make the request specific"
  },
  {
    description: "Reference records that verify account ownership, activity, and support history.",
    icon: FileText,
    title: "Connect the evidence"
  }
];

export function StatementBuilder({ onCaseChanged, selectedCase }: StatementBuilderProps) {
  const [statement, setStatement] = useState<CaseStatement | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [savedDraftContent, setSavedDraftContent] = useState("");
  const [guidance, setGuidance] = useState<SaveStatementGuidanceInput>({
    ...emptyStatementGuidance
  });
  const [savedGuidance, setSavedGuidance] = useState<SaveStatementGuidanceInput>({
    ...emptyStatementGuidance
  });
  const [summary, setSummary] = useState<GeneratedCaseSummary | null>(null);
  const [summaryHistoryCount, setSummaryHistoryCount] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuidanceSaving, setIsGuidanceSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummaryGenerating, setIsSummaryGenerating] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStatement() {
      setIsLoading(true);

      try {
        const response = await apiRequest<CaseStatementResponse>(
          `/api/cases/${selectedCase.id}/statement`
        );

        if (!isMounted) {
          return;
        }

        const initialContent = response.statement?.content ?? selectedCase.summary ?? "";
        const initialGuidance = toGuidanceInput(response.guidance);
        setStatement(response.statement);
        setDraftContent(initialContent);
        setSavedDraftContent(initialContent);
        setGuidance(initialGuidance);
        setSavedGuidance(initialGuidance);
        setSummary(response.summary);
        setSummaryHistoryCount(response.summaryHistory.length);
      } catch (error) {
        if (isMounted) {
          const initialContent = selectedCase.summary ?? "";
          setStatement(null);
          setDraftContent(initialContent);
          setSavedDraftContent(initialContent);
          setGuidance({ ...emptyStatementGuidance });
          setSavedGuidance({ ...emptyStatementGuidance });
          setSummary(null);
          setSummaryHistoryCount(0);
          setNotice({
            caseId: selectedCase.id,
            tone: "error",
            text: error instanceof Error ? error.message : "Statement workspace could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStatement();

    return () => {
      isMounted = false;
    };
  }, [selectedCase.id, selectedCase.summary]);

  const draftIsDirty = draftContent !== savedDraftContent;
  const guidanceIsDirty = !isGuidanceEqual(guidance, savedGuidance);
  const isBusy =
    isLoading ||
    isSaving ||
    isGuidanceSaving ||
    isGenerating ||
    isSummaryGenerating ||
    restoringVersionId !== null;
  const latestVersion = statement?.versions[0];
  const canSave = draftContent.trim().length > 0 && draftIsDirty && !isBusy;
  const visibleNotice = notice?.caseId === selectedCase.id ? notice : null;

  function showNotice(nextNotice: Omit<Notice, "caseId">) {
    setNotice({
      ...nextNotice,
      caseId: selectedCase.id
    });
  }

  async function persistDraft() {
    const savedStatement = await apiRequest<CaseStatement>(
      `/api/cases/${selectedCase.id}/statement`,
      {
        body: JSON.stringify({ content: draftContent }),
        method: "PUT"
      }
    );
    setStatement(savedStatement);
    setDraftContent(savedStatement.content);
    setSavedDraftContent(savedStatement.content);
    return savedStatement;
  }

  async function persistGuidance() {
    const saved = await apiRequest<StatementGuidanceRecord>(
      `/api/cases/${selectedCase.id}/statement/guidance`,
      {
        body: JSON.stringify(guidance),
        method: "PUT"
      }
    );
    const savedInput = toGuidanceInput(saved);
    setGuidance(savedInput);
    setSavedGuidance(savedInput);
    return saved;
  }

  async function handleSave() {
    setIsSaving(true);
    setNotice(null);

    try {
      await persistDraft();
      await onCaseChanged(selectedCase.id);
      showNotice({ tone: "success", text: "Statement version saved." });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Statement could not be saved."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveGuidance() {
    setIsGuidanceSaving(true);
    setNotice(null);

    try {
      await persistGuidance();
      showNotice({ tone: "success", text: "Guided answers saved." });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Guided answers could not be saved."
      });
    } finally {
      setIsGuidanceSaving(false);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    showNotice({ tone: "info", text: "Generating a draft from the saved case record..." });

    try {
      if (guidanceIsDirty) {
        setIsGuidanceSaving(true);
        await persistGuidance();
      }

      const generatedStatement = await apiRequest<CaseStatement>(
        `/api/cases/${selectedCase.id}/statement/generate`,
        {
          method: "POST"
        }
      );
      setStatement(generatedStatement);
      setDraftContent(generatedStatement.content);
      setSavedDraftContent(generatedStatement.content);
      await onCaseChanged(selectedCase.id);
      showNotice({ tone: "success", text: "Statement draft generated and saved as a new version." });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Statement could not be generated."
      });
    } finally {
      setIsGuidanceSaving(false);
      setIsGenerating(false);
    }
  }

  async function handleGenerateSummary() {
    setIsSummaryGenerating(true);
    showNotice({ tone: "info", text: "Reviewing the saved timeline and evidence..." });

    try {
      if (guidanceIsDirty) {
        setIsGuidanceSaving(true);
        await persistGuidance();
      }

      if (draftIsDirty && draftContent.trim()) {
        setIsSaving(true);
        await persistDraft();
      }

      const generatedSummary = await apiRequest<GeneratedCaseSummary>(
        `/api/cases/${selectedCase.id}/summary/generate`,
        {
          method: "POST"
        }
      );
      setSummary(generatedSummary);
      setSummaryHistoryCount((count) => Math.min(5, count + 1));
      await onCaseChanged(selectedCase.id);
      showNotice({ tone: "success", text: "Case summary generated from the saved record." });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Case summary could not be generated."
      });
    } finally {
      setIsGuidanceSaving(false);
      setIsSaving(false);
      setIsSummaryGenerating(false);
    }
  }

  async function handleRestore(versionId: string) {
    setRestoringVersionId(versionId);
    setNotice(null);

    try {
      const restoredStatement = await apiRequest<CaseStatement>(
        `/api/cases/${selectedCase.id}/statement/versions/${versionId}/restore`,
        {
          method: "POST"
        }
      );
      setStatement(restoredStatement);
      setDraftContent(restoredStatement.content);
      setSavedDraftContent(restoredStatement.content);
      await onCaseChanged(selectedCase.id);
      showNotice({ tone: "success", text: "Statement version restored as the current version." });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Statement version could not be restored."
      });
    } finally {
      setRestoringVersionId(null);
    }
  }

  return (
    <Card id="statement-builder" className="scroll-mt-28 lg:scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Statement builder</CardTitle>
            <CardDescription>Prepare the factual appeal statement and current case summary.</CardDescription>
          </div>
          {latestVersion ? <Badge variant="secondary">v{latestVersion.version}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {visibleNotice ? (
          <p
            aria-live="polite"
            className={getNoticeClassName(visibleNotice.tone)}
            role={visibleNotice.tone === "error" ? "alert" : "status"}
          >
            {visibleNotice.text}
          </p>
        ) : null}

        <StatementGuidance
          key={selectedCase.id}
          answers={guidance}
          disabled={isBusy}
          isDirty={guidanceIsDirty}
          isSaving={isGuidanceSaving}
          onAnswersChange={setGuidance}
          onSave={() => {
            void handleSaveGuidance();
          }}
          platform={selectedCase.platform}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <section aria-labelledby="statement-editor-title" className="min-w-0 rounded-md border border-border bg-secondary/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 id="statement-editor-title" className="text-xs font-semibold uppercase text-primary">
                Your statement
              </h4>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {draftIsDirty ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    Unsaved changes
                  </>
                ) : statement ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
                    Saved {formatDateTime(statement.updatedAt)}
                  </>
                ) : (
                  "Not saved"
                )}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              <Label className="sr-only" htmlFor="statement">
                Draft statement
              </Label>
              <Textarea
                className="min-h-72 resize-y leading-6 md:min-h-96"
                disabled={isBusy}
                id="statement"
                maxLength={12000}
                onChange={(event) => setDraftContent(event.target.value)}
                placeholder="Generate a draft or write the appeal statement."
                value={draftContent}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{countWords(draftContent).toLocaleString()} words</span>
                <span>{draftContent.length.toLocaleString()} / 12,000 characters</span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() => {
                  void handleGenerate();
                }}
                disabled={isBusy || draftIsDirty}
              >
                <WandSparkles className="h-4 w-4" aria-hidden="true" />
                {isGenerating ? "Generating..." : "Generate draft"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleSave();
                }}
                disabled={!canSave}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {isSaving ? "Saving..." : "Save version"}
              </Button>
            </div>
          </section>

          <aside className="grid content-start gap-4">
            <WritingTips />
            <StatementSummaryPanel
              disabled={isBusy}
              historyCount={summaryHistoryCount}
              isGenerating={isSummaryGenerating}
              onGenerate={() => {
                void handleGenerateSummary();
              }}
              summary={summary}
            />
          </aside>
        </div>

        <StatementVersionHistory
          disabled={isBusy}
          onRestore={(versionId) => {
            void handleRestore(versionId);
          }}
          restoringVersionId={restoringVersionId}
          versions={statement?.versions ?? []}
        />
      </CardContent>
    </Card>
  );
}

function WritingTips() {
  return (
    <section aria-labelledby="statement-writing-tips" className="rounded-md border border-border bg-secondary/25 p-4">
      <h4
        id="statement-writing-tips"
        className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"
      >
        <Lightbulb className="h-4 w-4" aria-hidden="true" />
        Writing tips
      </h4>
      <div className="mt-3 divide-y divide-border">
        {writingTips.map((tip) => {
          const Icon = tip.icon;

          return (
            <div key={tip.title} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 py-3 first:pt-0 last:pb-0">
              <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{tip.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{tip.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function toGuidanceInput(
  guidance: StatementGuidanceRecord | null
): SaveStatementGuidanceInput {
  if (!guidance) {
    return { ...emptyStatementGuidance };
  }

  return {
    platformAction: guidance.platformAction,
    actionDate: guidance.actionDate,
    reasonGiven: guidance.reasonGiven,
    accountUse: guidance.accountUse,
    supportContact: guidance.supportContact,
    requestedOutcome: guidance.requestedOutcome,
    supportingDocuments: guidance.supportingDocuments
  };
}

function isGuidanceEqual(
  first: SaveStatementGuidanceInput,
  second: SaveStatementGuidanceInput
) {
  return statementGuidanceFields.every((field) => first[field] === second[field]);
}

function countWords(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

function getNoticeClassName(tone: Notice["tone"]) {
  if (tone === "success") {
    return "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100";
  }

  if (tone === "error") {
    return "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100";
  }

  return "rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
