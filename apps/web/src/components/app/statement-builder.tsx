"use client";

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
import { StatementGuidance } from "@/components/app/statement/statement-guidance";
import { StatementSummaryPanel } from "@/components/app/statement/statement-summary-panel";
import { StatementVersionHistory } from "@/components/app/statement/statement-version-history";
import {
  useStatementBuilder,
  type StatementNotice
} from "@/components/app/statement/use-statement-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseRecord } from "@/lib/client/types";

interface StatementBuilderProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  readOnly: boolean;
  selectedCase: CaseRecord;
}

interface WritingTip {
  description: string;
  icon: LucideIcon;
  title: string;
}

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

/** Renders statement guidance, draft editing, summaries, and version history. */
export function StatementBuilder({
  onCaseChanged,
  readOnly,
  selectedCase
}: StatementBuilderProps) {
  const builder = useStatementBuilder({
    onCaseChanged,
    readOnly,
    selectedCase
  });

  return (
    <Card id="statement-builder" className="scroll-mt-28 lg:scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Statement builder</CardTitle>
            <CardDescription>
              Prepare the factual appeal statement and current case summary.
            </CardDescription>
          </div>
          {builder.latestVersion ? (
            <Badge variant="secondary">v{builder.latestVersion.version}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {builder.visibleNotice ? (
          <p
            aria-live="polite"
            className={getNoticeClassName(builder.visibleNotice.tone)}
            role={builder.visibleNotice.tone === "error" ? "alert" : "status"}
          >
            {builder.visibleNotice.text}
          </p>
        ) : null}

        <StatementGuidance
          key={selectedCase.id}
          answers={builder.guidance}
          disabled={builder.isBusy}
          isDirty={builder.guidanceIsDirty}
          isSaving={builder.isGuidanceSaving}
          onAnswersChange={builder.setGuidance}
          onSave={() => {
            void builder.saveGuidance();
          }}
          platform={selectedCase.platform}
          readOnly={readOnly}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <section
            aria-labelledby="statement-editor-title"
            className="min-w-0 rounded-md border border-border bg-secondary/15 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4
                id="statement-editor-title"
                className="text-xs font-semibold uppercase text-primary"
              >
                Your statement
              </h4>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {builder.draftIsDirty ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    Unsaved changes
                  </>
                ) : builder.statement ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
                    Saved {formatDateTime(builder.statement.updatedAt)}
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
                disabled={builder.isBusy}
                id="statement"
                maxLength={12000}
                onChange={(event) => builder.setDraftContent(event.target.value)}
                placeholder="Generate a draft or write the appeal statement."
                readOnly={readOnly}
                value={builder.draftContent}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{countWords(builder.draftContent).toLocaleString()} words</span>
                <span>
                  {builder.draftContent.length.toLocaleString()} / 12,000 characters
                </span>
              </div>
            </div>

            {!readOnly ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => {
                    void builder.generateDraft();
                  }}
                  disabled={builder.isBusy || builder.draftIsDirty}
                >
                  <WandSparkles className="h-4 w-4" aria-hidden="true" />
                  {builder.isGenerating ? "Generating..." : "Generate draft"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void builder.saveDraft();
                  }}
                  disabled={!builder.canSave}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {builder.isSaving ? "Saving..." : "Save version"}
                </Button>
              </div>
            ) : null}
          </section>

          <aside className="grid content-start gap-4">
            <WritingTips />
            <StatementSummaryPanel
              disabled={builder.isBusy || readOnly}
              historyCount={builder.summaryHistoryCount}
              isGenerating={builder.isSummaryGenerating}
              onGenerate={() => {
                void builder.generateSummary();
              }}
              summary={builder.summary}
            />
          </aside>
        </div>

        <StatementVersionHistory
          disabled={builder.isBusy || readOnly}
          onRestore={(versionId) => {
            void builder.restoreVersion(versionId);
          }}
          restoringVersionId={builder.restoringVersionId}
          versions={builder.statement?.versions ?? []}
        />
      </CardContent>
    </Card>
  );
}

/** Renders concise writing guidance beside the statement editor. */
function WritingTips() {
  return (
    <section
      aria-labelledby="statement-writing-tips"
      className="rounded-md border border-border bg-secondary/25 p-4"
    >
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
            <div
              key={tip.title}
              className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 py-3 first:pt-0 last:pb-0"
            >
              <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{tip.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {tip.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Counts whitespace-delimited words for the editor footer. */
function countWords(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

/** Maps statement feedback tone to its semantic visual treatment. */
function getNoticeClassName(tone: StatementNotice["tone"]) {
  if (tone === "success") {
    return "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100";
  }

  if (tone === "error") {
    return "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100";
  }

  return "rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100";
}

/** Formats the latest version timestamp for compact status copy. */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
