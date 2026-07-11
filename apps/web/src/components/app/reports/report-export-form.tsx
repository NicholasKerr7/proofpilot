"use client";

import { type FormEvent, useState } from "react";
import { CalendarDays, CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { reportExportSections, type ReportExportSection } from "@proofpilot/types";
import {
  getReportDateValue,
  getReportFilename,
  reportSectionOptions
} from "@/components/app/reports/report-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReportExportForm({ caseId, scopeLabel }: { caseId: string | null; scopeLabel: string }) {
  const [from, setFrom] = useState(() => getRelativeDateValue(30));
  const [to, setTo] = useState(() => getReportDateValue(new Date()));
  const [sections, setSections] = useState<ReportExportSection[]>([...reportExportSections]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function setPreset(days: number) {
    setFrom(getRelativeDateValue(days));
    setTo(getReportDateValue(new Date()));
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
      setNotice({ tone: "success", text: "CSV report downloaded." });
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
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <Card className="border-primary/45">
        <CardContent className="grid gap-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">Report scope</p>
            <p className="mt-1 break-words text-lg font-semibold">{scopeLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
          <CardDescription>Filters cases with recorded activity in the selected range.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[30, 60, 90].map((days) => (
              <Button key={days} onClick={() => setPreset(days)} size="sm" type="button" variant="outline">
                {days} days
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="report-from">Start date</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                <Input
                  className="min-h-12 pl-10"
                  id="report-from"
                  max={to}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setNotice(null);
                  }}
                  required
                  type="date"
                  value={from}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-to">End date</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                <Input
                  className="min-h-12 pl-10"
                  id="report-to"
                  min={from}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setNotice(null);
                  }}
                  required
                  type="date"
                  value={to}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Included sections</CardTitle>
          <CardDescription>Select the columns included in the CSV report.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {reportSectionOptions.map((option) => (
            <label
              className="grid min-h-12 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-border bg-secondary/25 px-3 py-2"
              key={option.value}
            >
              <input
                checked={sections.includes(option.value)}
                className="h-5 w-5 accent-primary"
                onChange={() => toggleSection(option.value)}
                type="checkbox"
              />
              <span className="text-sm font-medium text-foreground">{option.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-primary/50 bg-primary/10 p-4">
            <FileSpreadsheet className="h-6 w-6 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">CSV spreadsheet</p>
              <p className="mt-1 text-xs text-muted-foreground">Structured data for review and analysis.</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-teal-300" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>

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

      <Button disabled={isDownloading} size="lg" type="submit">
        <Download className="h-5 w-5" aria-hidden="true" />
        {isDownloading ? "Generating report..." : "Download CSV report"}
      </Button>
    </form>
  );
}

function getRelativeDateValue(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getReportDateValue(date);
}
