import type { CaseRecord, WorkspaceReminder } from "@/lib/client/types";

export type CalendarEventKind = "deadline" | "reminder";

export interface CalendarScheduleEvent {
  at: string;
  case: {
    id: string;
    platform: string;
    title: string;
  };
  id: string;
  isSent: boolean;
  kind: CalendarEventKind;
  title: string;
}

export function buildCalendarEvents(
  cases: CaseRecord[],
  reminders: WorkspaceReminder[]
): CalendarScheduleEvent[] {
  const deadlineEvents = cases.flatMap((caseRecord) =>
    caseRecord.deadline
      ? [
          {
            at: caseRecord.deadline,
            case: {
              id: caseRecord.id,
              platform: caseRecord.platform,
              title: caseRecord.title
            },
            id: `deadline:${caseRecord.id}`,
            isSent: false,
            kind: "deadline" as const,
            title: "Case deadline"
          }
        ]
      : []
  );
  const reminderEvents = reminders.map((reminder) => ({
    at: reminder.remindAt,
    case: reminder.case,
    id: `reminder:${reminder.id}`,
    isSent: Boolean(reminder.sentAt),
    kind: "reminder" as const,
    title: reminder.message
  }));

  return [...deadlineEvents, ...reminderEvents].sort(compareCalendarEvents);
}

export function filterCalendarEventsByCase(
  events: CalendarScheduleEvent[],
  caseId: string
) {
  return caseId === "all" ? events : events.filter((event) => event.case.id === caseId);
}

export function getCalendarMonthDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOffset = new Date(year, monthIndex, 1, 12).getDay();

  return Array.from(
    { length: 42 },
    (_, index) => new Date(year, monthIndex, index - firstDayOffset + 1, 12)
  );
}

export function getEventsForDate(events: CalendarScheduleEvent[], date: Date | string) {
  const dateKey = getCalendarDateKey(date);
  return events.filter((event) => getCalendarDateKey(event.at) === dateKey);
}

export function getEventsForMonth(events: CalendarScheduleEvent[], month: Date) {
  return events.filter((event) => isSameCalendarMonth(new Date(event.at), month));
}

export function getCalendarDateKey(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCalendarMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

export function shiftCalendarMonth(month: Date, offset: number) {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1, 12);
}

export function isSameCalendarMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function formatCalendarMonth(month: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(month);
}

export function formatCalendarDay(date: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatCalendarEventMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(value));
}

export function formatCalendarEventDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(new Date(value));
}

export function formatCalendarEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function compareCalendarEvents(left: CalendarScheduleEvent, right: CalendarScheduleEvent) {
  return new Date(left.at).getTime() - new Date(right.at).getTime();
}
