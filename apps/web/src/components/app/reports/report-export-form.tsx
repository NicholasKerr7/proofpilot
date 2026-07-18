"use client";

import { type FormEvent, useState } from "react";
import { Download } from "lucide-react";
import { reportExportSections, type ReportExportSection } from "@proofpilot/types";
import {
  ReportExportDateRange,
  type ReportDatePreset
} from "@/components/app/reports/report-export-date-range";
import { ReportExportOutput } from "@/components/app/reports/report-export-output";
import { ReportExportScope } from "@/components/app/reports/report-export-scope";
import { ReportExportSections } from "@/components/app/reports/report-export-sections";
import {
  getReportDateValue,
  getReportFilename
} from "@/components/app/reports/report-utils";
import { Button } from "@/components/ui/button";
import type { CaseRecord } from "@/lib/client/types";

interface ReportExportFormProps {
  caseId: string | null;
  scopeLabel: string;
  selectedCase: CaseRecord | null;
}

export function ReportExportForm({
  caseId,
  scopeLabel,
  selectedCase
}: ReportExportFormProps) {
  const [from, setFrom] = useState(() => getRelativeDateValue(30));
  const [to, setTo] = useState(() => getReportDateValue(new Date()));
  const [datePreset, setDatePreset] = useState<ReportDatePreset>(30);
  const [sections, setSections] = useState<ReportExportSection[]>([...reportExportSections]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function setPreset(preset: ReportDatePreset) {
    setDatePreset(preset);

    if (preset !== "custom") {
      setFrom(getRelativeDateValue(preset));
      setTo(getReportDateValue(new Date()));
    }

    setNotice(null);
  }

  function toggleSection(section: ReportExportSection) {
    setSections((currentSections) =>
      currentSections.includes(section)
        ? currentSections.filter((currentSection) => currentSection !== section)
        : [...currentSections, section]
    );
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!sections.length) {
      setNotice({ tone: "error", text: "Select at least one report section." });
      return;
    }

    if (from > to) {
      setNotice({ tone: "error", text: "Start date must be on or before the end date." });
      return;
    }

    setIsDownloading(true);

    try {
      const searchParams = new URLSearchParams({
        from,
        to,
        sections: sections.join(",")
      });

      if (caseId) {
        searchParams.set("caseId", caseId);
      }

      const response = await fetch(`/api/reports/export?${searchParams}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Report could not be generated.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = getReportFilename(response);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice({ tone: "success", text: `${scopeLabel} CSV report downloaded.` });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Report could not be generated."
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <form aria-busy={isDownloading} className="grid gap-5" onSubmit={handleSubmit}>
      <ReportExportScope scopeLabel={scopeLabel} selectedCase={selectedCase} />

      <ReportExportDateRange
        from={from}
        onFromChange={(value) => {
          setFrom(value);
          setNotice(null);
        }}
        onPresetChange={setPreset}
        onToChange={(value) => {
          setTo(value);
          setNotice(null);
        }}
        preset={datePreset}
        to={to}
      />

      <ReportExportSections onToggle={toggleSection} sections={sections} />

      <ReportExportOutput />

      {notice ? (
        <p
          className={
            notice.tone === "success"
              ? "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100"
              : "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
          }
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      <Button className="min-h-14 md:text-base" disabled={isDownloading} size="lg" type="submit">
        <Download className="h-5 w-5" aria-hidden="true" />
        {isDownloading ? "Generating report..." : "Export CSV report"}
      </Button>
    </form>
  );
}

function getRelativeDateValue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getReportDateValue(date);
}
