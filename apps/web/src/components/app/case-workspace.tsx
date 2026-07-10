"use client";

import { useCallback } from "react";
import { ChecklistPanel } from "@/components/app/checklist-panel";
import { EvidencePanel } from "@/components/app/evidence/evidence-panel";
import { PacketExportPanel } from "@/components/app/packet-export-panel";
import { ReminderPanel } from "@/components/app/reminder-panel";
import { StatementBuilder } from "@/components/app/statement-builder";
import { TimelinePanel } from "@/components/app/timeline-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CaseRecord } from "@/lib/client/types";

interface CaseWorkspaceProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onNotificationsChanged: () => void;
  selectedCase: CaseRecord | null;
}

export function CaseWorkspace({
  onCaseChanged,
  onNotificationsChanged,
  selectedCase
}: CaseWorkspaceProps) {
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

  const readiness = getReadiness(selectedCase);

  return (
    <div className="grid grid-cols-1 gap-5">
      <Card>
        <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge>{selectedCase.platform}</Badge>
              <Badge variant="secondary">{selectedCase.caseType.name}</Badge>
            </div>
            <CardTitle className="text-xl md:text-2xl">{selectedCase.title}</CardTitle>
            <CardDescription>{selectedCase.summary ?? "No summary added yet."}</CardDescription>
          </div>
          <div className="min-w-52 rounded-md border border-border bg-secondary/35 p-3">
            <Progress value={readiness} label="Packet readiness" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <EvidencePanel
          selectedCase={selectedCase}
          onDocumentsChanged={handleDocumentsChanged}
        />

        <TimelinePanel selectedCase={selectedCase} onCaseChanged={onCaseChanged} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ChecklistPanel selectedCase={selectedCase} onCaseChanged={onCaseChanged} />

        <ReminderPanel
          key={selectedCase.id}
          onNotificationsChanged={onNotificationsChanged}
          selectedCase={selectedCase}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.55fr)]">
        <StatementBuilder onCaseChanged={onCaseChanged} selectedCase={selectedCase} />

        <PacketExportPanel
          onNotificationsChanged={onNotificationsChanged}
          onCaseChanged={onCaseChanged}
          readiness={readiness}
          selectedCase={selectedCase}
        />
      </div>
    </div>
  );
}

function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
}

function getReadiness(caseRecord: CaseRecord) {
  const documentScore = Math.min(40, (caseRecord._count?.documents ?? 0) * 10);
  const eventScore = Math.min(25, (caseRecord._count?.events ?? 0) * 8);
  const checklistItems = caseRecord.checklist ?? [];
  const completedChecklistItems = checklistItems.filter((item) => isChecklistReady(item.status));
  const checklistScore = checklistItems.length
    ? Math.round((completedChecklistItems.length / checklistItems.length) * 25)
    : 0;
  const statementScore = caseRecord.summary || caseRecord._count?.statements ? 10 : 0;

  return documentScore + eventScore + checklistScore + statementScore;
}
