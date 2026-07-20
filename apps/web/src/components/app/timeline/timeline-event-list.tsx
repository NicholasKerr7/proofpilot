import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  FileImage,
  FileText,
  Mail,
  MessageSquareText,
  Pencil,
  PenLine,
  Trash2,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CaseEvent } from "@/lib/client/types";

const timelinePlaceholders = [
  "Account action notice received",
  "Support ticket or appeal submitted",
  "Platform response received"
];

interface TimelineEventListProps {
  busyEventId: string | null;
  canReorder: boolean;
  editingEventId: string | null;
  editor: ReactNode;
  events: CaseEvent[];
  onCancelDelete: () => void;
  onConfirmDelete: (eventId: string) => Promise<void>;
  onEdit: (event: CaseEvent) => void;
  onMove: (eventId: string, direction: "up" | "down") => Promise<void>;
  onRequestDelete: (event: CaseEvent) => void;
  orderedEventIds: string[];
  pendingDeleteEventId: string | null;
  showPlaceholders: boolean;
}

export function TimelineEventList({
  busyEventId,
  canReorder,
  editingEventId,
  editor,
  events,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onMove,
  onRequestDelete,
  orderedEventIds,
  pendingDeleteEventId,
  showPlaceholders
}: TimelineEventListProps) {
  if (showPlaceholders) {
    return (
      <div className="grid gap-2" aria-label="Timeline preparation steps">
        {timelinePlaceholders.map((item, index) => (
          <div
            key={item}
            className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 rounded-md border border-dashed border-border bg-secondary/25 p-3 md:grid-cols-[5.5rem_minmax(0,1fr)]"
          >
            <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{item}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Waiting for processed evidence or manual entry.
              </span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="rounded-md border border-dashed border-border bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">
        No events match this timeline filter.
      </p>
    );
  }

  return (
    <ol className="grid" aria-label="Case timeline events">
      {events.map((timelineEvent) => {
        const sourceNames = timelineEvent.sources.map((source) => source.document.originalName);
        const source = sourceNames[0] ?? null;
        const isManual = !source;
        const orderIndex = orderedEventIds.indexOf(timelineEvent.id);
        const isBusy = busyEventId === timelineEvent.id;
        const isPendingDelete = pendingDeleteEventId === timelineEvent.id;

        return (
          <li
            key={timelineEvent.id}
            className="grid grid-cols-[3rem_minmax(0,1fr)] gap-1 md:grid-cols-[6rem_minmax(0,1fr)] md:gap-4"
          >
            <time
              className="pt-4 text-xs font-medium text-muted-foreground md:text-sm"
              dateTime={timelineEvent.occurredAt}
            >
              <span className="block text-foreground">
                {formatTimelineMonthDay(timelineEvent.occurredAt)}
              </span>
              <span className="mt-1 block">{formatTimelineYear(timelineEvent.occurredAt)}</span>
            </time>
            <div className="relative grid gap-2 border-l border-border pb-3 pl-3 md:pl-6">
              <span
                className="absolute -left-1.5 top-5 h-3 w-3 rounded-full border-2 border-primary bg-background shadow-[0_0_14px_rgba(255,107,22,0.45)]"
                aria-hidden="true"
              />
              <article className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-2 rounded-md border border-border bg-secondary/35 p-3 md:grid-cols-[2.75rem_minmax(0,1fr)] md:gap-3 md:p-4">
                <span
                  className={
                    isManual
                      ? "flex h-9 w-9 items-center justify-center rounded-md border border-teal-400/25 bg-teal-400/10 text-teal-100 md:h-11 md:w-11"
                      : "flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary md:h-11 md:w-11"
                  }
                >
                  <TimelineSourceIcon event={timelineEvent} source={source} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="min-w-0 text-sm font-semibold leading-5 text-foreground md:text-base">
                      {timelineEvent.title}
                    </h4>
                    {typeof timelineEvent.confidence === "number" ? (
                      <Badge variant="secondary">
                        {Math.round(timelineEvent.confidence * 100)}% confidence
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Manual</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {timelineEvent.description ?? "Added to support the appeal chronology."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      className="max-w-full gap-1.5"
                      variant="secondary"
                      title={sourceNames.length ? sourceNames.join(", ") : "Manual entry"}
                    >
                      {isManual ? (
                        <PenLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">
                        Source: {source ?? "Manual entry"}
                        {sourceNames.length > 1 ? ` +${sourceNames.length - 1}` : ""}
                      </span>
                    </Badge>

                    <div className="flex flex-wrap justify-end gap-0 sm:gap-1" aria-label={`Actions for ${timelineEvent.title}`}>
                      {canReorder ? (
                        <>
                          <Button
                            aria-label={`Move ${timelineEvent.title} up`}
                            disabled={Boolean(busyEventId) || orderIndex <= 0}
                            onClick={() => {
                              void onMove(timelineEvent.id, "up");
                            }}
                            size="icon"
                            title="Move event up"
                            type="button"
                            variant="ghost"
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            aria-label={`Move ${timelineEvent.title} down`}
                            disabled={
                              Boolean(busyEventId) || orderIndex === orderedEventIds.length - 1
                            }
                            onClick={() => {
                              void onMove(timelineEvent.id, "down");
                            }}
                            size="icon"
                            title="Move event down"
                            type="button"
                            variant="ghost"
                          >
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </>
                      ) : null}
                      <Button
                        aria-label={`Edit ${timelineEvent.title}`}
                        disabled={Boolean(busyEventId)}
                        onClick={() => onEdit(timelineEvent)}
                        size="icon"
                        title="Edit event"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        aria-label={`Delete ${timelineEvent.title}`}
                        disabled={Boolean(busyEventId)}
                        onClick={() => onRequestDelete(timelineEvent)}
                        size="icon"
                        title="Delete event"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>

              {isPendingDelete ? (
                <TimelineDeleteConfirmation
                  isDeleting={isBusy}
                  onCancel={onCancelDelete}
                  onConfirm={() => onConfirmDelete(timelineEvent.id)}
                />
              ) : null}

              {editingEventId === timelineEvent.id ? editor : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TimelineDeleteConfirmation({
  isDeleting,
  onCancel,
  onConfirm
}: {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-100">
      <span>Delete this timeline event?</span>
      <span className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button disabled={isDeleting} onClick={onCancel} size="sm" type="button" variant="ghost">
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button
          disabled={isDeleting}
          onClick={() => {
            void onConfirm();
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </span>
    </div>
  );
}

function TimelineSourceIcon({ event, source }: { event: CaseEvent; source: string | null }) {
  if (!source) {
    return <PenLine className="h-5 w-5" aria-hidden="true" />;
  }

  const normalizedSource = source.toLowerCase();
  const normalizedTitle = event.title.toLowerCase();

  if (normalizedSource.endsWith(".eml") || normalizedSource.endsWith(".msg")) {
    return <Mail className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalizedSource.match(/\.(png|jpe?g|webp)$/)) {
    return <FileImage className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalizedTitle.includes("support") || normalizedTitle.includes("conversation")) {
    return <MessageSquareText className="h-5 w-5" aria-hidden="true" />;
  }

  return <CalendarClock className="h-5 w-5" aria-hidden="true" />;
}

function formatTimelineMonthDay(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function formatTimelineYear(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric"
  }).format(new Date(value));
}
