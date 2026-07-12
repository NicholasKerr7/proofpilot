"use client";

import { useEffect, useState } from "react";
import { BellPlus, CalendarClock, CheckCircle2, Clock3, ListFilter, RefreshCcw } from "lucide-react";
import {
  ReminderComposer,
  type CreateReminderInput
} from "@/components/app/reminders/reminder-composer";
import type { UpdateReminderInput } from "@/components/app/reminders/reminder-detail";
import { ReminderList } from "@/components/app/reminders/reminder-list";
import {
  formatReminderDateTime,
  formatReminderRelativeTime,
  getDefaultReminderValue,
  getReminderStatus,
  matchesReminderFilter,
  sortReminders,
  type ReminderFilter
} from "@/components/app/reminders/reminder-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord, CaseReminder } from "@/lib/client/types";

const reminderFilters = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Sent", value: "sent" },
  { label: "Completed", value: "completed" },
  { label: "All", value: "all" }
] as const;

interface ReminderPanelProps {
  onNotificationsChanged: () => void;
  selectedCase: CaseRecord;
}

type Notice = {
  tone: "error" | "success";
  text: string;
};

export function ReminderPanel({ onNotificationsChanged, selectedCase }: ReminderPanelProps) {
  const [reminders, setReminders] = useState<CaseReminder[]>([]);
  const [filter, setFilter] = useState<ReminderFilter>("upcoming");
  const [expandedReminderId, setExpandedReminderId] = useState<string | null>(null);
  const [reminderToDeleteId, setReminderToDeleteId] = useState<string | null>(null);
  const [deletingReminderId, setDeletingReminderId] = useState<string | null>(null);
  const [updatingReminderId, setUpdatingReminderId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const sortedReminders = sortReminders(reminders);
  const filteredReminders = sortedReminders.filter((reminder) =>
    matchesReminderFilter(reminder, filter)
  );
  const pendingReminders = sortedReminders.filter(
    (reminder) => !reminder.sentAt && !reminder.completedAt
  );
  const nextReminder = pendingReminders[0] ?? null;

  useEffect(() => {
    let isMounted = true;

    async function loadReminders() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextReminders = await apiRequest<CaseReminder[]>(
          `/api/cases/${selectedCase.id}/reminders`
        );

        if (isMounted) {
          setReminders(nextReminders);
          setExpandedReminderId((currentId) =>
            currentId && nextReminders.some((reminder) => reminder.id === currentId)
              ? currentId
              : null
          );
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Reminders could not be loaded."
          });
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
  }, [selectedCase.id]);

  async function handleCreateReminder(input: CreateReminderInput) {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const reminder = await apiRequest<CaseReminder>(
        `/api/cases/${selectedCase.id}/reminders`,
        {
          body: JSON.stringify(input),
          method: "POST"
        }
      );
      setReminders((currentReminders) => sortReminders([...currentReminders, reminder]));
      setExpandedReminderId(reminder.id);
      setFilter("upcoming");
      setNotice({ tone: "success", text: "Reminder saved." });
      onNotificationsChanged();
      return true;
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Reminder could not be saved."
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteReminder() {
    if (!reminderToDeleteId) {
      return;
    }

    setDeletingReminderId(reminderToDeleteId);
    setNotice(null);

    try {
      await apiRequest(`/api/reminders/${reminderToDeleteId}`, {
        method: "DELETE"
      });
      setReminders((currentReminders) =>
        currentReminders.filter((reminder) => reminder.id !== reminderToDeleteId)
      );
      setExpandedReminderId((currentId) =>
        currentId === reminderToDeleteId ? null : currentId
      );
      setReminderToDeleteId(null);
      setNotice({ tone: "success", text: "Reminder removed." });
      onNotificationsChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Reminder could not be removed."
      });
    } finally {
      setDeletingReminderId(null);
    }
  }

  async function handleUpdateReminder(
    reminderId: string,
    input: UpdateReminderInput
  ) {
    setUpdatingReminderId(reminderId);
    setNotice(null);

    try {
      const updatedReminder = await apiRequest<CaseReminder>(`/api/reminders/${reminderId}`, {
        body: JSON.stringify(input),
        method: "PATCH"
      });
      setReminders((currentReminders) =>
        sortReminders(
          currentReminders.map((reminder) =>
            reminder.id === updatedReminder.id ? updatedReminder : reminder
          )
        )
      );
      setExpandedReminderId(updatedReminder.id);
      setFilter(getFilterForReminder(updatedReminder));
      setNotice({ tone: "success", text: getReminderUpdateMessage(input) });
      onNotificationsChanged();
      return true;
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Reminder could not be updated."
      });
      return false;
    } finally {
      setUpdatingReminderId(null);
    }
  }

  function handleToggleComposer() {
    setNotice(null);
    setIsComposerOpen((current) => !current);
  }

  return (
    <Card id="case-reminders" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Reminders &amp; deadlines</CardTitle>
            <Badge variant="secondary">{pendingReminders.length} pending</Badge>
          </div>
          <CardDescription>Schedule deadline and review prompts for this case.</CardDescription>
        </div>
        <Button
          aria-expanded={isComposerOpen}
          onClick={handleToggleComposer}
          size="sm"
          type="button"
          variant={isComposerOpen ? "secondary" : "default"}
        >
          <BellPlus className="h-4 w-4" aria-hidden="true" />
          Add reminder
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice ? (
          <p
            className={getNoticeClassName(notice.tone)}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.text}
          </p>
        ) : null}

        <dl className="grid gap-3 border-y border-border py-4 sm:grid-cols-3">
          <ReminderSummary
            icon="deadline"
            label="Case deadline"
            value={
              selectedCase.deadline
                ? formatReminderDateTime(selectedCase.deadline)
                : "No deadline set"
            }
          />
          <ReminderSummary
            icon="next"
            label="Next prompt"
            value={nextReminder ? formatReminderRelativeTime(nextReminder.remindAt) : "None scheduled"}
          />
          <ReminderSummary
            icon="pending"
            label="Pending prompts"
            value={String(pendingReminders.length)}
          />
        </dl>

        {isComposerOpen ? (
          <ReminderComposer
            caseId={selectedCase.id}
            defaultRemindAt={getDefaultReminderValue(selectedCase)}
            isSubmitting={isSubmitting}
            onCancel={() => setIsComposerOpen(false)}
            onSubmit={handleCreateReminder}
          />
        ) : null}

        <div className="grid gap-3 rounded-md border border-border bg-secondary/25 p-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-3">
          <div className="flex items-center gap-2 px-1">
            <ListFilter className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Scheduled prompts</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {filteredReminders.length} shown
              </span>
            </span>
          </div>
          <div
            aria-label="Filter reminders"
            className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background/35 p-1 sm:grid-cols-4"
            role="group"
          >
            {reminderFilters.map((item) => (
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

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/25 px-3 py-3 text-sm text-muted-foreground">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Loading reminders
          </div>
        ) : null}

        <ReminderList
          deletingReminderId={deletingReminderId}
          expandedReminderId={expandedReminderId}
          isLoading={isLoading}
          isUpdatingReminderId={updatingReminderId}
          onCancelDelete={() => setReminderToDeleteId(null)}
          onConfirmDelete={handleDeleteReminder}
          onRequestDelete={setReminderToDeleteId}
          onToggleReminder={(reminderId) =>
            setExpandedReminderId((currentId) =>
              currentId === reminderId ? null : reminderId
            )
          }
          onUpdateReminder={handleUpdateReminder}
          reminderToDeleteId={reminderToDeleteId}
          reminders={filteredReminders}
          selectedCase={selectedCase}
        />
      </CardContent>
    </Card>
  );
}

function ReminderSummary({
  icon,
  label,
  value
}: {
  icon: "deadline" | "next" | "pending";
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:border-l sm:border-border sm:pl-3 first:sm:border-l-0 first:sm:pl-0">
      <span className="pt-0.5 text-primary">
        {icon === "deadline" ? <CalendarClock className="h-4 w-4" aria-hidden="true" /> : null}
        {icon === "next" ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : null}
        {icon === "pending" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 break-words text-sm font-medium leading-5 text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function getNoticeClassName(tone: Notice["tone"]) {
  return tone === "success"
    ? "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100"
    : "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100";
}

function getFilterForReminder(reminder: CaseReminder): ReminderFilter {
  const status = getReminderStatus(reminder);

  if (status === "completed") {
    return "completed";
  }

  if (status === "sent") {
    return "sent";
  }

  return "upcoming";
}

function getReminderUpdateMessage(input: UpdateReminderInput) {
  if (input.completed === true) {
    return "Reminder marked complete.";
  }

  if (input.completed === false) {
    return "Reminder reopened.";
  }

  if (input.remindAt) {
    return "Reminder rescheduled.";
  }

  return "Reminder updated.";
}
