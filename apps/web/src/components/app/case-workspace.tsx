"use client";

import { CalendarClock, CheckCircle2, Clock3, FileArchive, FileText, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { CaseRecord } from "@/lib/client/types";

interface CaseWorkspaceProps {
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

export function CaseWorkspace({ selectedCase }: CaseWorkspaceProps) {
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
          <Card>
            <CardHeader>
              <CardTitle>Evidence intake</CardTitle>
              <CardDescription>Upload support files for this case.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-primary/45 bg-primary/10 p-5 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/20 text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <p className="font-semibold">Evidence upload is next</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Sprint 2 will connect file validation, private storage, and processing jobs.
                  </p>
                </div>
              </div>
              <div className="rounded-md border border-border bg-secondary/45 px-3 py-2 text-sm text-muted-foreground">
                {selectedCase._count?.documents ?? 0} files currently linked
              </div>
            </CardContent>
          </Card>

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
            <CardTitle>Evidence checklist</CardTitle>
            <CardDescription>Core requirements for an account appeal packet.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {checklistPlaceholders.map((item, index) => (
              <div
                key={item}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/45 px-3 py-3"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {index < 2 ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate">{item}</span>
                </span>
                <Badge variant={index < 2 ? "secondary" : "warning"}>
                  {index < 2 ? "Ready" : "Missing"}
                </Badge>
              </div>
            ))}
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

function getReadiness(caseRecord: CaseRecord) {
  const documentScore = Math.min(40, (caseRecord._count?.documents ?? 0) * 10);
  const eventScore = Math.min(25, (caseRecord._count?.events ?? 0) * 8);
  const checklistScore = Math.min(25, (caseRecord._count?.checklist ?? 0) * 5);
  const statementScore = caseRecord.summary ? 10 : 0;

  return documentScore + eventScore + checklistScore + statementScore;
}
