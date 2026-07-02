"use client";

import { useCallback, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, FileArchive, FileText, RefreshCcw } from "lucide-react";
import { EvidencePanel } from "@/components/app/evidence/evidence-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

interface CaseWorkspaceProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  selectedCase: CaseRecord | null;
}

const timelinePlaceholders = [
  "Account action notice received",
  "Support ticket or appeal submitted",
  "Platform response received"
];

const checklistPlaceholders = [
  "Closure or restriction screenshot",
  "Support conversation",
  "Account ownership proof",
  "Transaction or activity context"
];

type ChecklistNotice = {
  tone: "success" | "error";
  text: string;
};

export function CaseWorkspace({ onCaseChanged, selectedCase }: CaseWorkspaceProps) {
  const [isAnalyzingChecklist, setIsAnalyzingChecklist] = useState(false);
  const [checklistNotice, setChecklistNotice] = useState<ChecklistNotice | null>(null);
  const selectedCaseId = selectedCase?.id ?? null;
  const handleDocumentsChanged = useCallback(async () => {
    if (selectedCaseId) {
      await onCaseChanged(selectedCaseId);
    }
  }, [onCaseChanged, selectedCaseId]);

  if (!selectedCase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case workspace</CardTitle>
          <CardDescription>Select a case to review evidence, timeline, statement, and packet readiness.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-secondary/35 p-5 text-sm text-muted-foreground">
            The workspace opens after a case is selected.
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handleAnalyzeChecklist() {
    if (!selectedCase) {
      return;
    }

    setIsAnalyzingChecklist(true);
    setChecklistNotice(null);

    try {
      await apiRequest(`/api/cases/${selectedCase.id}/checklist/analyze`, {
        method: "POST"
      });
      await onCaseChanged(selectedCase.id);
      setChecklistNotice({
        tone: "success",
        text: "Checklist refreshed from processed evidence."
      });
    } catch (error) {
      setChecklistNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Checklist analysis failed."
      });
    } finally {
      setIsAnalyzingChecklist(false);
    }
  }

  const checklistItems = selectedCase.checklist?.length
    ? selectedCase.checklist
    : checklistPlaceholders.map((label) => ({
        id: label,
        label,
        description: "Upload and process evidence to analyze this requirement.",
        matches: [],
        status: "MISSING",
        updatedAt: ""
      }));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{selectedCase.platform}</Badge>
              <Badge variant="secondary">{selectedCase.caseType.name}</Badge>
            </div>
            <CardTitle>{selectedCase.title}</CardTitle>
            <CardDescription>{selectedCase.summary ?? "No summary added yet."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={getReadiness(selectedCase)} label="Packet readiness" />
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <EvidencePanel
            selectedCase={selectedCase}
            onDocumentsChanged={handleDocumentsChanged}
          />

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Chronology generated from evidence and manual events.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {timelinePlaceholders.map((item, index) => (
                <div key={item} className="grid grid-cols-[76px_1fr] gap-3">
                  <div className="text-xs font-medium text-muted-foreground">Step {index + 1}</div>
                  <div className="border-l border-border pl-4">
                    <p className="text-sm font-semibold">{item}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Waiting for evidence processing</p>
                  </div>
                </div>
              ))}
              <Button variant="outline">
                <CalendarClock className="h-4 w-4" />
                Add event
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <aside className="grid gap-5">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Evidence checklist</CardTitle>
                <CardDescription>Core requirements for an account appeal packet.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleAnalyzeChecklist();
                }}
                disabled={isAnalyzingChecklist}
              >
                <RefreshCcw className="h-4 w-4" />
                {isAnalyzingChecklist ? "Analyzing..." : "Analyze evidence"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {checklistNotice ? (
              <p
                className={
                  checklistNotice.tone === "success"
                    ? "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100"
                    : "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
                }
              >
                {checklistNotice.text}
              </p>
            ) : null}

            {checklistItems.map((checklistItem) => {
              const firstMatch = checklistItem.matches?.[0];
              return (
                <div
                  key={checklistItem.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/45 px-3 py-3"
                >
                  <span className="flex min-w-0 items-start gap-2 text-sm">
                    {isChecklistReady(checklistItem.status) ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate">{checklistItem.label}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {firstMatch
                          ? `Matched ${firstMatch.document.originalName}`
                          : checklistItem.description}
                      </span>
                    </span>
                  </span>
                  <Badge variant={getChecklistStatusVariant(checklistItem.status)}>
                    {formatChecklistStatus(checklistItem.status)}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statement builder</CardTitle>
            <CardDescription>Draft the outcome request and explanation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="statement">Draft statement</Label>
              <Textarea
                id="statement"
                defaultValue={selectedCase.summary ?? ""}
                placeholder="Explain what happened, what evidence supports it, and what action you want the platform to take."
              />
            </div>
            <Button variant="secondary">
              <FileText className="h-4 w-4" />
              Save draft
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Packet export</CardTitle>
            <CardDescription>PDF packet sections for review.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Progress value={getReadiness(selectedCase)} label="Overall readiness" />
            <Separator />
            {["Case summary", "Timeline", "Evidence index", "User statement"].map((section) => (
              <div key={section} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {section}
                </span>
                <Badge variant="secondary">Draft</Badge>
              </div>
            ))}
            <Button>
              <FileArchive className="h-4 w-4" />
              Generate packet
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function formatChecklistStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
}

function getChecklistStatusVariant(status: string) {
  if (isChecklistReady(status)) {
    return "success";
  }

  if (status === "OPTIONAL") {
    return "secondary";
  }

  return "warning";
}

function getReadiness(caseRecord: CaseRecord) {
  const documentScore = Math.min(40, (caseRecord._count?.documents ?? 0) * 10);
  const eventScore = Math.min(25, (caseRecord._count?.events ?? 0) * 8);
  const checklistItems = caseRecord.checklist ?? [];
  const completedChecklistItems = checklistItems.filter((item) => isChecklistReady(item.status));
  const checklistScore = checklistItems.length
    ? Math.round((completedChecklistItems.length / checklistItems.length) * 25)
    : 0;
  const statementScore = caseRecord.summary ? 10 : 0;

  return documentScore + eventScore + checklistScore + statementScore;
}
