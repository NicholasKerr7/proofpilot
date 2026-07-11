"use client";

import { useState } from "react";
import { CalendarPlus, RefreshCcw } from "lucide-react";
import { TimelineEventComposer } from "@/components/app/timeline/timeline-event-composer";
import { TimelineEventList } from "@/components/app/timeline/timeline-event-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { CaseEvent, CaseRecord, CreateTimelineEventPayload } from "@/lib/client/types";

const timelineFilters = [
  { label: "All", value: "all" },
  { label: "Evidence", value: "evidence" },
  { label: "Manual", value: "manual" }
] as const;

type TimelineFilter = (typeof timelineFilters)[number]["value"];

interface TimelinePanelProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  selectedCase: CaseRecord;
}

type TimelineNotice = {
  tone: "success" | "error";
  text: string;
};

export function TimelinePanel({ onCaseChanged, selectedCase }: TimelinePanelProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAnalyzingTimeline, setIsAnalyzingTimeline] = useState(false);
  const [timelineNotice, setTimelineNotice] = useState<TimelineNotice | null>(null);
  const timelineEvents = getSortedTimelineEvents(selectedCase.events ?? []);
  const filteredEvents = timelineEvents.filter((event) => matchesTimelineFilter(event, filter));
  const evidenceEventCount = timelineEvents.filter((event) => event.sources.length > 0).length;

  async function handleAddTimelineEvent(payload: CreateTimelineEventPayload) {
    setTimelineNotice(null);

    try {
      await apiRequest(`/api/cases/${selectedCase.id}/timeline`, {
        body: JSON.stringify(payload),
        method: "POST"
      });
      await onCaseChanged(selectedCase.id);
      setTimelineNotice({
        tone: "success",
        text: "Timeline event added."
      });
      return true;
    } catch (error) {
      setTimelineNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Timeline event could not be added."
      });
      return false;
    }
  }

  async function handleAnalyzeTimeline() {
    setIsAnalyzingTimeline(true);
    setTimelineNotice(null);

    try {
      await apiRequest(`/api/cases/${selectedCase.id}/timeline/analyze`, {
        method: "POST"
      });
      await onCaseChanged(selectedCase.id);
      setTimelineNotice({
        tone: "success",
        text: "Timeline refreshed from processed evidence."
      });
    } catch (error) {
      setTimelineNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Timeline analysis failed."
      });
    } finally {
      setIsAnalyzingTimeline(false);
    }
  }

  return (
    <Card id="case-timeline" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Timeline</CardTitle>
            <Badge variant="secondary">{timelineEvents.length} events</Badge>
          </div>
          <CardDescription>Chronology from evidence and important manual dates.</CardDescription>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            disabled={isAnalyzingTimeline}
            onClick={() => {
              void handleAnalyzeTimeline();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            {isAnalyzingTimeline ? "Analyzing..." : "Analyze"}
          </Button>
          <Button
            aria-expanded={isComposerOpen}
            onClick={() => setIsComposerOpen((current) => !current)}
            size="sm"
            type="button"
            variant={isComposerOpen ? "secondary" : "default"}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Add event
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {timelineNotice ? (
          <p
            className={
              timelineNotice.tone === "success"
                ? "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100"
                : "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            }
            role={timelineNotice.tone === "error" ? "alert" : "status"}
          >
            {timelineNotice.text}
          </p>
        ) : null}

        {isComposerOpen ? (
          <TimelineEventComposer
            onCancel={() => setIsComposerOpen(false)}
            onSubmit={handleAddTimelineEvent}
          />
        ) : null}

        <div className="grid gap-3 rounded-md border border-border bg-secondary/25 p-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-3">
          <div className="px-1">
            <p className="text-sm font-semibold text-foreground">Case chronology</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {evidenceEventCount} evidence-linked, {timelineEvents.length - evidenceEventCount} manual
            </p>
          </div>
          <div
            aria-label="Filter timeline events"
            className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background/35 p-1"
            role="group"
          >
            {timelineFilters.map((item) => (
              <Button
                key={item.value}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                size="sm"
                type="button"
                variant={filter === item.value ? "secondary" : "ghost"}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <TimelineEventList
          events={filteredEvents}
          showPlaceholders={timelineEvents.length === 0}
        />
      </CardContent>
    </Card>
  );
}

function matchesTimelineFilter(event: CaseEvent, filter: TimelineFilter) {
  if (filter === "all") {
    return true;
  }

  return filter === "evidence" ? event.sources.length > 0 : event.sources.length === 0;
}

function getSortedTimelineEvents(events: CaseEvent[]) {
  return [...events].sort(
    (firstEvent, secondEvent) =>
      new Date(firstEvent.occurredAt).getTime() - new Date(secondEvent.occurredAt).getTime()
  );
}
