"use client";

import { type FormEvent, useState } from "react";
import { CalendarPlus, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord, CreateTimelineEventPayload } from "@/lib/client/types";

interface TimelinePanelProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  selectedCase: CaseRecord;
}

type TimelineNotice = {
  tone: "success" | "error";
  text: string;
};

const timelinePlaceholders = [
  "Account action notice received",
  "Support ticket or appeal submitted",
  "Platform response received"
];

export function TimelinePanel({ onCaseChanged, selectedCase }: TimelinePanelProps) {
  const [eventDate, setEventDate] = useState(() => getDateInputValue());
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [isAnalyzingTimeline, setIsAnalyzingTimeline] = useState(false);
  const [timelineNotice, setTimelineNotice] = useState<TimelineNotice | null>(null);

  async function handleAddTimelineEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = eventTitle.trim();
    const description = eventDescription.trim();

    if (!eventDate) {
      setTimelineNotice({
        tone: "error",
        text: "Choose the event date before saving."
      });
      return;
    }

    if (!title) {
      setTimelineNotice({
        tone: "error",
        text: "Add a short event title before saving."
      });
      return;
    }

    setIsAddingEvent(true);
    setTimelineNotice(null);

    try {
      const payload: CreateTimelineEventPayload = {
        occurredAt: toTimelineIsoDate(eventDate),
        title,
        ...(description ? { description } : {})
      };

      await apiRequest(`/api/cases/${selectedCase.id}/timeline`, {
        body: JSON.stringify(payload),
        method: "POST"
      });
      await onCaseChanged(selectedCase.id);
      setEventDate(getDateInputValue());
      setEventTitle("");
      setEventDescription("");
      setTimelineNotice({
        tone: "success",
        text: "Timeline event added."
      });
    } catch (error) {
      setTimelineNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Timeline event could not be added."
      });
    } finally {
      setIsAddingEvent(false);
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
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Chronology from evidence and important manual dates.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleAnalyzeTimeline();
            }}
            disabled={isAnalyzingTimeline}
          >
            <RefreshCcw className="h-4 w-4" />
            {isAnalyzingTimeline ? "Analyzing..." : "Analyze timeline"}
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
          >
            {timelineNotice.text}
          </p>
        ) : null}

        <form
          className="grid gap-3 rounded-md border border-border bg-secondary/35 p-3"
          onSubmit={handleAddTimelineEvent}
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(128px,0.45fr)_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="timeline-event-date">Date</Label>
              <Input
                id="timeline-event-date"
                type="date"
                value={eventDate}
                onChange={(event) => {
                  setEventDate(event.target.value);
                }}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="timeline-event-title">Event</Label>
              <Input
                id="timeline-event-title"
                value={eventTitle}
                onChange={(event) => {
                  setEventTitle(event.target.value);
                }}
                maxLength={160}
                placeholder="Account closure notice received"
                required
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="timeline-event-description">Details</Label>
            <Textarea
              id="timeline-event-description"
              value={eventDescription}
              onChange={(event) => {
                setEventDescription(event.target.value);
              }}
              maxLength={2000}
              placeholder="Add the context needed for the appeal packet."
            />
          </div>
          <Button type="submit" className="w-full sm:w-fit" disabled={isAddingEvent}>
            <CalendarPlus className="h-4 w-4" />
            {isAddingEvent ? "Adding..." : "Add event"}
          </Button>
        </form>

        {selectedCase.events?.length ? (
          selectedCase.events.map((timelineEvent) => {
            const source = timelineEvent.sources[0]?.document.originalName ?? "Manual entry";

            return (
              <div key={timelineEvent.id} className="grid grid-cols-[96px_1fr] gap-3">
                <div className="text-xs font-medium text-muted-foreground">
                  {formatTimelineDate(timelineEvent.occurredAt)}
                </div>
                <div className="border-l border-border pl-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{timelineEvent.title}</p>
                    {typeof timelineEvent.confidence === "number" ? (
                      <Badge variant="secondary">{Math.round(timelineEvent.confidence * 100)}%</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {timelineEvent.description ?? "Added to support the appeal chronology."}
                  </p>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    Source: {source}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          timelinePlaceholders.map((item, index) => (
            <div key={item} className="grid grid-cols-[96px_1fr] gap-3">
              <div className="text-xs font-medium text-muted-foreground">Step {index + 1}</div>
              <div className="border-l border-border pl-4">
                <p className="text-sm font-semibold">{item}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Waiting for processed evidence or manual entry
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function getDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function toTimelineIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
}
