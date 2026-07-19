"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellPlus,
  ChevronLeft,
  ChevronRight,
  RefreshCcw
} from "lucide-react";
import { CalendarAgenda } from "@/components/app/calendar/calendar-agenda";
import { CalendarGrid } from "@/components/app/calendar/calendar-grid";
import {
  buildCalendarEvents,
  filterCalendarEventsByCase,
  formatCalendarDay,
  formatCalendarMonth,
  getCalendarDateKey,
  getCalendarMonthDays,
  getCalendarMonthStart,
  getEventsForDate,
  getEventsForMonth,
  shiftCalendarMonth,
  type CalendarScheduleEvent
} from "@/components/app/calendar/calendar-utils";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord, WorkspaceReminder } from "@/lib/client/types";

interface CalendarDeadlinesPanelProps {
  cases: CaseRecord[];
  onOpenCase: (caseId: string, destinationId: CaseDestinationId) => Promise<void>;
  selectedCaseId: string | null;
}

export function CalendarDeadlinesPanel({
  cases,
  onOpenCase,
  selectedCaseId
}: CalendarDeadlinesPanelProps) {
  const [today] = useState(() => new Date());
  const [reminders, setReminders] = useState<WorkspaceReminder[]>([]);
  const [caseFilter, setCaseFilter] = useState(() =>
    selectedCaseId && cases.some((caseRecord) => caseRecord.id === selectedCaseId)
      ? selectedCaseId
      : "all"
  );
  const [visibleMonth, setVisibleMonth] = useState(() => getCalendarMonthStart(today));
  const [selectedDateKey, setSelectedDateKey] = useState(() => getCalendarDateKey(today));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const allEvents = useMemo(() => buildCalendarEvents(cases, reminders), [cases, reminders]);
  const filteredEvents = useMemo(
    () => filterCalendarEventsByCase(allEvents, caseFilter),
    [allEvents, caseFilter]
  );
  const monthEvents = useMemo(
    () => getEventsForMonth(filteredEvents, visibleMonth),
    [filteredEvents, visibleMonth]
  );
  const selectedDateEvents = useMemo(
    () => getEventsForDate(filteredEvents, selectedDateKey),
    [filteredEvents, selectedDateKey]
  );
  const agendaEvents = monthEvents.slice(0, 8);
  const selectedDate = new Date(`${selectedDateKey}T12:00:00`);
  const scheduleCase =
    cases.find((caseRecord) => caseRecord.id === caseFilter) ??
    cases.find((caseRecord) => caseRecord.id === selectedCaseId) ??
    cases[0] ??
    null;

  useEffect(() => {
    let isMounted = true;

    async function loadReminders() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiRequest<WorkspaceReminder[]>("/api/reminders");

        if (isMounted) {
          setReminders(result);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError instanceof Error ? requestError.message : "Reminders could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReminders();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleMoveMonth(offset: number) {
    const nextMonth = shiftCalendarMonth(visibleMonth, offset);
    setVisibleMonth(nextMonth);
    setSelectedDateKey(getCalendarDateKey(nextMonth));
  }

  function handleSelectDate(date: Date) {
    setSelectedDateKey(getCalendarDateKey(date));
    setVisibleMonth(getCalendarMonthStart(date));
  }

  function handleToday() {
    setVisibleMonth(getCalendarMonthStart(today));
    setSelectedDateKey(getCalendarDateKey(today));
  }

  function handleOpenEvent(event: CalendarScheduleEvent) {
    void onOpenCase(
      event.case.id,
      event.kind === "reminder" ? "case-reminders" : "case-overview"
    );
  }

  const deadlineCount = monthEvents.filter((event) => event.kind === "deadline").length;
  const reminderCount = monthEvents.filter((event) => event.kind === "reminder").length;

  return (
    <section aria-labelledby="calendar-deadlines-heading" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Workspace schedule</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="calendar-deadlines-heading">
            Calendar &amp; deadlines
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review case deadlines and every scheduled reminder in one place.
          </p>
        </div>
        <Button
          disabled={!scheduleCase}
          onClick={() => {
            if (scheduleCase) {
              void onOpenCase(scheduleCase.id, "case-reminders");
            }
          }}
          type="button"
        >
          <BellPlus aria-hidden="true" className="h-4 w-4" />
          Schedule reminder
        </Button>
      </div>

      {error ? (
        <p
          className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
          role="alert"
        >
          {error} Case deadlines are still available.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <Card>
        <CardHeader className="gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle>{formatCalendarMonth(visibleMonth)}</CardTitle>
            {isLoading ? (
              <Badge variant="secondary">
                <RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />
                Loading reminders
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-44 gap-1.5">
              <Label htmlFor="calendar-case-filter">Case</Label>
              <Select
                id="calendar-case-filter"
                onChange={(event) => setCaseFilter(event.target.value)}
                value={caseFilter}
              >
                <option value="all">All active cases</option>
                {cases.map((caseRecord) => (
                  <option key={caseRecord.id} value={caseRecord.id}>
                    {caseRecord.title}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              aria-label="Previous month"
              onClick={() => handleMoveMonth(-1)}
              size="icon"
              title="Previous month"
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button onClick={handleToday} type="button" variant="outline">
              Today
            </Button>
            <Button
              aria-label="Next month"
              onClick={() => handleMoveMonth(1)}
              size="icon"
              title="Next month"
              type="button"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-3 gap-2 border-y border-border py-3 text-center">
            <CalendarMetric label="Deadlines" value={deadlineCount} />
            <CalendarMetric label="Reminders" value={reminderCount} />
            <CalendarMetric label="Selected day" value={selectedDateEvents.length} />
          </dl>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-300" aria-hidden="true" />
              Case deadline
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />
              Reminder
            </span>
          </div>
          <CalendarGrid
            days={getCalendarMonthDays(visibleMonth)}
            events={filteredEvents}
            onSelectDate={handleSelectDate}
            selectedDateKey={selectedDateKey}
            todayDateKey={getCalendarDateKey(today)}
            visibleMonth={visibleMonth}
          />
        </CardContent>
        </Card>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Card>
          <CardHeader>
            <CardTitle>{formatCalendarDay(selectedDate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarAgenda
              compact
              emptyMessage="Nothing is scheduled for this day."
              events={selectedDateEvents}
              nowTimestamp={today.getTime()}
              onOpenEvent={handleOpenEvent}
            />
          </CardContent>
          </Card>

          <Card>
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start">
            <div>
              <CardTitle>Month agenda</CardTitle>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Deadlines and reminders in {formatCalendarMonth(visibleMonth)}.
              </p>
            </div>
            <Badge variant="secondary">{agendaEvents.length}</Badge>
          </CardHeader>
          <CardContent>
            <CalendarAgenda
              emptyMessage="No deadlines or reminders in this month."
              events={agendaEvents}
              nowTimestamp={today.getTime()}
              onOpenEvent={handleOpenEvent}
            />
          </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function CalendarMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground sm:text-xs">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-foreground">{value}</dd>
    </div>
  );
}
