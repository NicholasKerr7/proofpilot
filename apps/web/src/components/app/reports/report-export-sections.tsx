import {
  BriefcaseBusiness,
  Clock3,
  FileArchive,
  FileText,
  FolderOpen,
  ListChecks,
  type LucideIcon
} from "lucide-react";
import type { ReportExportSection } from "@proofpilot/types";
import { reportSectionOptions } from "@/components/app/reports/report-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const reportSectionIcons: Record<ReportExportSection, LucideIcon> = {
  overview: BriefcaseBusiness,
  evidence: FolderOpen,
  timeline: Clock3,
  checklist: ListChecks,
  statement: FileText,
  packet: FileArchive
};

interface ReportExportSectionsProps {
  onToggle: (section: ReportExportSection) => void;
  sections: ReportExportSection[];
}

export function ReportExportSections({ onToggle, sections }: ReportExportSectionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase text-primary">2. Report sections</CardTitle>
        <CardDescription>Choose the case data included in the CSV export.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {reportSectionOptions.map((option) => {
          const Icon = reportSectionIcons[option.value];

          return (
            <label
              className="grid min-h-12 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-secondary/25 px-3 py-2 hover:bg-secondary/45"
              key={option.value}
            >
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{option.label}</span>
              <input
                checked={sections.includes(option.value)}
                className="h-5 w-5 accent-primary"
                onChange={() => onToggle(option.value)}
                type="checkbox"
              />
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
