import {
  getCalendarDateKey,
  isSameCalendarMonth
} from "@/components/app/calendar/calendar-utils";
import type { CalendarScheduleEvent } from "@/components/app/calendar/calendar-utils";
import { cn } from "@/lib/utils";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarGridProps {
  days: Date[];
  events: CalendarScheduleEvent[];
  onSelectDate: (date: Date) => void;
  selectedDateKey: string;
  todayDateKey: string;
  visibleMonth: Date;
}

export function CalendarGrid({
  days,
  events,
  onSelectDate,
  selectedDateKey,
  todayDateKey,
  visibleMonth
}: CalendarGridProps) {
  const eventsByDate = new Map<string, CalendarScheduleEvent[]>();

  for (const event of events) {
    const dateKey = getCalendarDateKey(event.at);
    eventsByDate.set(dateKey, [...(eventsByDate.get(dateKey) ?? []), event]);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
        {weekdayLabels.map((label) => (
          <div
            className="py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs"
            key={label}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {days.map((date) => {
          const dateKey = getCalendarDateKey(date);
          const dateEvents = eventsByDate.get(dateKey) ?? [];
          const isSelected = selectedDateKey === dateKey;
          const isToday = todayDateKey === dateKey;
          const isCurrentMonth = isSameCalendarMonth(date, visibleMonth);
          const dateLabel = new Intl.DateTimeFormat(undefined, {
            dateStyle: "full"
          }).format(date);

          return (
            <button
              aria-label={`${dateLabel}, ${dateEvents.length} scheduled ${dateEvents.length === 1 ? "item" : "items"}`}
              aria-pressed={isSelected}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 bg-background px-1 py-2 text-sm text-foreground transition-colors hover:bg-secondary/45 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-20 sm:justify-start sm:items-start sm:p-2 md:min-h-24",
                !isCurrentMonth ? "text-muted-foreground/45" : null,
                isSelected ? "bg-primary/15 text-foreground" : null
              )}
              key={dateKey}
              onClick={() => onSelectDate(date)}
              type="button"
            >
              <time
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  isToday ? "border border-primary text-primary" : null,
                  isSelected ? "bg-primary font-semibold text-primary-foreground" : null
                )}
                dateTime={dateKey}
              >
                {date.getDate()}
              </time>
              {dateEvents.length ? (
                <span className="flex max-w-full items-center gap-1" aria-hidden="true">
                  {dateEvents.slice(0, 3).map((event) => (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        event.kind === "deadline" ? "bg-red-300" : "bg-amber-300",
                        event.isSent ? "opacity-45" : null
                      )}
                      key={event.id}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
