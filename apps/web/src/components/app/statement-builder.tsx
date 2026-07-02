"use client";

import { useEffect, useState } from "react";
import { FileText, Save, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord, CaseStatement, CaseStatementResponse } from "@/lib/client/types";

interface StatementBuilderProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  selectedCase: CaseRecord;
}

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

export function StatementBuilder({ onCaseChanged, selectedCase }: StatementBuilderProps) {
  const [statement, setStatement] = useState<CaseStatement | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStatement() {
      setIsLoading(true);
      setNotice(null);

      try {
        const response = await apiRequest<CaseStatementResponse>(
          `/api/cases/${selectedCase.id}/statement`
        );

        if (!isMounted) {
          return;
        }

        setStatement(response.statement);
        setDraftContent(response.statement?.content ?? selectedCase.summary ?? "");
      } catch (error) {
        if (isMounted) {
          setStatement(null);
          setDraftContent(selectedCase.summary ?? "");
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Statement could not be loaded."
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

  async function handleSave() {
    setIsSaving(true);
    setNotice(null);

    try {
      const savedStatement = await apiRequest<CaseStatement>(
        `/api/cases/${selectedCase.id}/statement`,
        {
          body: JSON.stringify({ content: draftContent }),
          method: "PUT"
        }
      );
      setStatement(savedStatement);
      setDraftContent(savedStatement.content);
      await onCaseChanged(selectedCase.id);
      setNotice({ tone: "success", text: "Statement draft saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Statement could not be saved."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setNotice({ tone: "info", text: "Generating statement draft from case evidence..." });

    try {
      const generatedStatement = await apiRequest<CaseStatement>(
        `/api/cases/${selectedCase.id}/statement/generate`,
        {
          method: "POST"
        }
      );
      setStatement(generatedStatement);
      setDraftContent(generatedStatement.content);
      await onCaseChanged(selectedCase.id);
      setNotice({ tone: "success", text: "Statement draft generated." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Statement could not be generated."
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const latestVersion = statement?.versions[0];
  const canSave = draftContent.trim().length > 0 && !isSaving && !isGenerating;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Statement builder</CardTitle>
            <CardDescription>Current appeal statement and saved versions.</CardDescription>
          </div>
          {latestVersion ? <Badge variant="secondary">v{latestVersion.version}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice ? (
          <p className={getNoticeClassName(notice.tone)}>
            {notice.text}
          </p>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="statement">Draft statement</Label>
          <Textarea
            className="min-h-64 resize-y"
            disabled={isLoading || isSaving || isGenerating}
            id="statement"
            onChange={(event) => setDraftContent(event.target.value)}
            placeholder="Generate a draft or write the appeal statement."
            value={draftContent}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{draftContent.trim().length.toLocaleString()} characters</span>
            {statement ? <span>Saved {formatDateTime(statement.updatedAt)}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={!canSave}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save draft"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void handleGenerate();
            }}
            disabled={isSaving || isGenerating}
          >
            <WandSparkles className="h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate draft"}
          </Button>
        </div>

        {statement?.versions.length ? (
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Version history
            </div>
            {statement.versions.slice(0, 3).map((version) => (
              <div
                key={version.id}
                className="rounded-md border border-border bg-secondary/45 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">Version {version.version}</span>
                  <span className="text-muted-foreground">{formatDateTime(version.createdAt)}</span>
                </div>
                <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">
                  {version.content}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
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
