"use client";

import { useState } from "react";
import { CalendarDays, CalendarPlus, FileCheck2, Flag, RefreshCcw } from "lucide-react";
import { TimelineEventComposer } from "@/components/app/timeline/timeline-event-composer";
import { TimelineEventList } from "@/components/app/timeline/timeline-event-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type {
  CaseEvent,
  CaseRecord,
  EvidenceDocument,
  TimelineEventPayload
} from "@/lib/client/types";

const timelineFilters = [
  { label: "All", value: "all" },
  { label: "Evidence", value: "evidence" },
  { label: "Manual", value: "manual" }
] as const;

type TimelineFilter = (typeof timelineFilters)[number]["value"];

interface TimelinePanelProps {
  confirmBeforeDelete: boolean;
  onCaseChanged: (caseId: string) => Promise<unknown>;
  selectedCase: CaseRecord;
}

type TimelineNotice = {
  tone: "success" | "error";
  text: string;
};

export function TimelinePanel({
  confirmBeforeDelete,
  onCaseChanged,
  selectedCase
}: TimelinePanelProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAnalyzingTimeline, setIsAnalyzingTimeline] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [timelineNotice, setTimelineNotice] = useState<TimelineNotice | null>(null);
  const timelineEvents = getOrderedTimelineEvents(selectedCase.events ?? []);
  const filteredEvents = timelineEvents.filter((event) => matchesTimelineFilter(event, filter));
  const evidenceEventCount = timelineEvents.filter((event) => event.sources.length > 0).length;
  const editingEvent =
    timelineEvents.find((timelineEvent) => timelineEvent.id === editingEventId) ?? null;

  async function handleAddTimelineEvent(payload: TimelineEventPayload) {
    setBusyEventId("new");
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
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleUpdateTimelineEvent(payload: TimelineEventPayload) {
    if (!editingEventId) {
      return false;
    }

    setBusyEventId(editingEventId);
    setTimelineNotice(null);

    try {
      await apiRequest(`/api/cases/${selectedCase.id}/timeline/${editingEventId}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      });
      await onCaseChanged(selectedCase.id);
      setTimelineNotice({
        tone: "success",
        text: "Timeline event updated."
      });
      return true;
    } catch (error) {
      setTimelineNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Timeline event could not be updated."
      });
      return false;
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleDeleteTimelineEvent(eventId: string) {
    setBusyEventId(eventId);
    setTimelineNotice(null);

    try {
      await apiRequest(`/api/cases/${selectedCase.id}/timeline/${eventId}`, {
        method: "DELETE"
      });
      await onCaseChanged(selectedCase.id);
      setPendingDeleteEventId(null);
      setEditingEventId((currentId) => (currentId === eventId ? null : currentId));
      setTimelineNotice({
        tone: "success",
        text: "Timeline event deleted."
      });
    } catch (error) {
      setTimelineNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Timeline event could not be deleted."
      });
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleMoveTimelineEvent(eventId: string, direction: "up" | "down") {
    const eventIds = timelineEvents.map((event) => event.id);
    const currentIndex = eventIds.indexOf(eventId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= eventIds.length) {
      return;
    }

    [eventIds[currentIndex], eventIds[targetIndex]] = [
      eventIds[targetIndex],
      eventIds[currentIndex]
    ];
    setBusyEventId(eventId);
    setTimelineNotice(null);

    try {
      await apiRequest(`/api/cases/${selectedCase.id}/timeline/order`, {
        body: JSON.stringify({ eventIds }),
        method: "PUT"
      });
      await onCaseChanged(selectedCase.id);
      setTimelineNotice({
        tone: "success",
        text: "Timeline order updated."
      });
    } catch (error) {
      setTimelineNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Timeline order could not be updated."
      });
    } finally {
      setBusyEventId(null);
    }
  }

  async function loadTimelineDocuments() {
    setIsLoadingDocuments(true);

    try {
      const nextDocuments = await apiRequest<EvidenceDocument[]>(
        `/api/cases/${selectedCase.id}/documents`
      );
      setDocuments(nextDocuments);
    } catch (error) {
      setTimelineNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Case evidence could not be loaded."
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  function handleOpenComposer() {
    const willOpen = !isComposerOpen;
    setIsComposerOpen(willOpen);
    setEditingEventId(null);
    setPendingDeleteEventId(null);

    if (willOpen) {
      void loadTimelineDocuments();
    }
  }

  function handleEditTimelineEvent(event: CaseEvent) {
    setIsComposerOpen(false);
    setEditingEventId(event.id);
    setPendingDeleteEventId(null);
    void loadTimelineDocuments();
  }

  function handleRequestDelete(event: CaseEvent) {
    setEditingEventId(null);

    if (confirmBeforeDelete) {
      setPendingDeleteEventId(event.id);
      return;
    }

    void handleDeleteTimelineEvent(event.id);
  }

  async function handleAnalyzeTimeline() {
    setIsAnalyzingTimeline(true);
    setTimelineNotice(null);

    try {
      setIsComposerOpen(false);
      setEditingEventId(null);
      setPendingDeleteEventId(null);
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
    <Card id="case-timeline" className="scroll-mt-28 lg:scroll-mt-24">
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
            disabled={isAnalyzingTimeline || Boolean(busyEventId)}
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
            disabled={isAnalyzingTimeline || Boolean(busyEventId)}
            onClick={handleOpenComposer}
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
            documents={documents}
            isLoadingDocuments={isLoadingDocuments}
            key="new-timeline-event"
            onCancel={() => setIsComposerOpen(false)}
            onSubmit={handleAddTimelineEvent}
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
          <div className="grid gap-4">
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
                    onClick={() => {
                      setFilter(item.value);
                      setEditingEventId(null);
                      setPendingDeleteEventId(null);
                    }}
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
              busyEventId={isAnalyzingTimeline ? "timeline-analysis" : busyEventId}
              canReorder={filter === "all"}
              editingEventId={editingEventId}
              editor={
                editingEvent ? (
                  <TimelineEventComposer
                    documents={documents}
                    event={editingEvent}
                    isLoadingDocuments={isLoadingDocuments}
                    key={editingEvent.id}
                    onCancel={() => setEditingEventId(null)}
                    onSubmit={handleUpdateTimelineEvent}
                  />
                ) : null
              }
              events={filteredEvents}
              onCancelDelete={() => setPendingDeleteEventId(null)}
              onConfirmDelete={handleDeleteTimelineEvent}
              onEdit={handleEditTimelineEvent}
              onMove={handleMoveTimelineEvent}
              onRequestDelete={handleRequestDelete}
              orderedEventIds={timelineEvents.map((event) => event.id)}
              pendingDeleteEventId={pendingDeleteEventId}
              showPlaceholders={timelineEvents.length === 0}
            />
          </div>

          <TimelineSummary
            deadline={selectedCase.deadline}
            evidenceEventCount={evidenceEventCount}
            events={timelineEvents}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineSummary({
  deadline,
  evidenceEventCount,
  events
}: {
  deadline: string | null;
  evidenceEventCount: number;
  events: CaseEvent[];
}) {
  const chronologicalEvents = [...events].sort(
    (firstEvent, secondEvent) =>
      new Date(firstEvent.occurredAt).getTime() - new Date(secondEvent.occurredAt).getTime()
  );
  const firstEvent = chronologicalEvents[0] ?? null;
  const latestEvent = chronologicalEvents.at(-1) ?? null;

  return (
    <aside className="hidden gap-3 xl:grid" aria-label="Timeline summary">
      <section className="rounded-md border border-border bg-secondary/25 p-4">
        <h4 className="text-xs font-semibold uppercase text-primary">Timeline summary</h4>
        <dl className="mt-3 divide-y divide-border">
          <TimelineSummaryRow
            icon={CalendarDays}
            label="First event"
            value={firstEvent ? formatTimelineDate(firstEvent.occurredAt) : "Not added"}
          />
          <TimelineSummaryRow
            icon={Flag}
            label="Latest event"
            value={latestEvent ? formatTimelineDate(latestEvent.occurredAt) : "Not added"}
          />
          <TimelineSummaryRow
            icon={FileCheck2}
            label="Evidence linked"
            value={`${evidenceEventCount} of ${events.length}`}
          />
        </dl>
      </section>

      <section className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <h4 className="text-xs font-semibold uppercase text-primary">Case deadline</h4>
        <p className="mt-3 text-base font-semibold text-foreground">
          {deadline ? formatTimelineDate(deadline) : "No deadline set"}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Keep the chronology complete through the final submission date.
        </p>
      </section>
    </aside>
  );
}

function TimelineSummaryRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function matchesTimelineFilter(event: CaseEvent, filter: TimelineFilter) {
  if (filter === "all") {
    return true;
  }

  return filter === "evidence" ? event.sources.length > 0 : event.sources.length === 0;
}

function getOrderedTimelineEvents(events: CaseEvent[]) {
  return [...events].sort(
    (firstEvent, secondEvent) =>
      firstEvent.sortOrder - secondEvent.sortOrder ||
      new Date(firstEvent.occurredAt).getTime() - new Date(secondEvent.occurredAt).getTime()
  );
}
