"use client";

import {
  Bell,
  CalendarClock,
  Clock3,
  FileArchive,
  FolderOpen,
  ListChecks,
  PenLine,
  Plus,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseRecord } from "@/lib/client/types";

const caseCommands: Array<{
  destinationId: CaseDestinationId;
  icon: LucideIcon;
  label: string;
}> = [
  { destinationId: "evidence-intake", icon: UploadCloud, label: "Evidence" },
  { destinationId: "case-timeline", icon: Clock3, label: "Timeline" },
  { destinationId: "evidence-checklist", icon: ListChecks, label: "Checklist" },
  { destinationId: "statement-builder", icon: PenLine, label: "Statement" },
  { destinationId: "packet-export", icon: FileArchive, label: "Packet" },
  { destinationId: "case-reminders", icon: CalendarClock, label: "Reminders" }
];

interface MoreMenuProps {
  onCreateCase: () => void;
  onOpenCase: (caseId: string, destinationId: CaseDestinationId) => Promise<void>;
  onOpenNotifications: () => void;
  onViewCases: () => void;
  selectedCase: CaseRecord | null;
}

export function MoreMenu({
  onCreateCase,
  onOpenCase,
  onOpenNotifications,
  onViewCases,
  selectedCase
}: MoreMenuProps) {
  return (
    <section aria-labelledby="more-menu-heading" className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-primary">Workspace navigation</p>
        <h1 id="more-menu-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
          More
        </h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start">
            <div>
              <CardTitle>Active case</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {selectedCase?.title ?? "No case selected"}
              </p>
            </div>
            {selectedCase ? <Badge variant="secondary">{selectedCase.platform}</Badge> : null}
          </CardHeader>
          <CardContent>
            {selectedCase ? (
              <div className="grid grid-cols-2 gap-2">
                {caseCommands.map((command) => (
                  <Button
                    key={command.destinationId}
                    className="justify-start"
                    onClick={() => {
                      void onOpenCase(selectedCase.id, command.destinationId);
                    }}
                    type="button"
                    variant="outline"
                  >
                    <command.icon className="h-4 w-4" aria-hidden="true" />
                    {command.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">
                Select a case to open its evidence, timeline, checklist, statement, and packet tools.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button className="justify-start" onClick={onViewCases} type="button" variant="outline">
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              All cases
            </Button>
            <Button className="justify-start" onClick={onCreateCase} type="button" variant="outline">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create case
            </Button>
            <Button
              className="justify-start"
              onClick={onOpenNotifications}
              type="button"
              variant="outline"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              Notifications
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
