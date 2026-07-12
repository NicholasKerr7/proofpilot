import { BellRing, CalendarClock, ChevronRight, Inbox } from "lucide-react";
import {
  formatCalendarEventDay,
  formatCalendarEventMonth,
  formatCalendarEventTime,
  type CalendarScheduleEvent
} from "@/components/app/calendar/calendar-utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CalendarAgendaProps {
  compact?: boolean;
  emptyMessage: string;
  events: CalendarScheduleEvent[];
  nowTimestamp: number;
  onOpenEvent: (event: CalendarScheduleEvent) => void;
}

export function CalendarAgenda({
  compact = false,
  emptyMessage,
  events,
  nowTimestamp,
  onOpenEvent
}: CalendarAgendaProps) {
  if (!events.length) {
    return (
      <div className="grid min-h-40 place-items-center border-y border-dashed border-border px-4 py-8 text-center">
        <div>
          <Inbox aria-hidden="true" className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border border-y border-border">
      {events.map((event) => (
        <button
          className={cn(
            "group grid w-full items-center gap-3 px-1 py-3 text-left hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3",
            compact
              ? "grid-cols-[auto_minmax(0,1fr)_auto]"
              : "grid-cols-[3rem_auto_minmax(0,1fr)_auto] sm:grid-cols-[3.5rem_auto_minmax(0,1fr)_auto]"
          )}
          key={event.id}
          onClick={() => onOpenEvent(event)}
          type="button"
        >
          <span
            className={cn(
              "grid justify-items-center border-r border-border pr-3 text-muted-foreground",
              compact ? "hidden" : null
            )}
          >
            <span className="text-[10px] font-semibold uppercase">
              {formatCalendarEventMonth(event.at)}
            </span>
            <span className="mt-0.5 text-lg font-semibold leading-none text-foreground">
              {formatCalendarEventDay(event.at)}
            </span>
          </span>
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md border",
              event.kind === "deadline"
                ? "border-red-400/30 bg-red-400/10 text-red-100"
                : "border-amber-400/30 bg-amber-400/10 text-amber-100"
            )}
          >
            {event.kind === "deadline" ? (
              <CalendarClock aria-hidden="true" className="h-4 w-4" />
            ) : (
              <BellRing aria-hidden="true" className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "gap-2",
                compact ? "grid justify-items-start" : "flex flex-wrap items-center"
              )}
            >
              <span className="break-words text-sm font-semibold text-foreground">
                {event.title}
              </span>
              <EventBadge event={event} nowTimestamp={nowTimestamp} />
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {formatCalendarEventTime(event.at)} · {event.case.platform}
            </span>
            <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
              {event.case.title}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
          />
        </button>
      ))}
    </div>
  );
}

function EventBadge({
  event,
  nowTimestamp
}: {
  event: CalendarScheduleEvent;
  nowTimestamp: number;
}) {
  if (event.kind === "deadline") {
    return <Badge variant="danger">Deadline</Badge>;
  }

  if (event.isSent) {
    return <Badge variant="success">Sent</Badge>;
  }

  if (new Date(event.at).getTime() < nowTimestamp) {
    return <Badge variant="danger">Overdue</Badge>;
  }

  return <Badge variant="warning">Reminder</Badge>;
}
