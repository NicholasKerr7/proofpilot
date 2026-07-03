"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock3, RefreshCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord, CaseReminder } from "@/lib/client/types";

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

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

  async function handleCreateReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const remindAt = String(formData.get("remindAt") ?? "");
    const message = String(formData.get("message") ?? "").trim();

    try {
      const reminder = await apiRequest<CaseReminder>(`/api/cases/${selectedCase.id}/reminders`, {
        body: JSON.stringify({
          remindAt: new Date(remindAt).toISOString(),
          ...(message ? { message } : {})
        }),
        method: "POST"
      });
      setReminders((currentReminders) =>
        [...currentReminders, reminder].sort(
          (first, second) => new Date(first.remindAt).getTime() - new Date(second.remindAt).getTime()
        )
      );
      form.reset();
      setNotice({ tone: "success", text: "Reminder saved." });
      onNotificationsChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Reminder could not be saved."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteReminder(reminderId: string) {
    setNotice(null);

    try {
      await apiRequest(`/api/reminders/${reminderId}`, {
        method: "DELETE"
      });
      setReminders((currentReminders) =>
        currentReminders.filter((reminder) => reminder.id !== reminderId)
      );
      setNotice({ tone: "success", text: "Reminder removed." });
      onNotificationsChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Reminder could not be removed."
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Reminders</CardTitle>
            <CardDescription>Schedule deadline and review prompts for this case.</CardDescription>
          </div>
          <Badge variant="secondary">{reminders.length} scheduled</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice ? <p className={getNoticeClassName(notice.tone)}>{notice.text}</p> : null}

        <form className="grid gap-3" onSubmit={handleCreateReminder}>
          <div className="grid gap-2">
            <Label htmlFor={`reminder-at-${selectedCase.id}`}>Reminder time</Label>
            <Input
              id={`reminder-at-${selectedCase.id}`}
              name="remindAt"
              type="datetime-local"
              defaultValue={getDefaultReminderValue(selectedCase)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`reminder-message-${selectedCase.id}`}>Message</Label>
            <Textarea
              id={`reminder-message-${selectedCase.id}`}
              name="message"
              placeholder="Review missing evidence before the platform deadline."
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            <Clock3 className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save reminder"}
          </Button>
        </form>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            <span>Scheduled prompts</span>
            {isLoading ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCcw className="h-3.5 w-3.5" />
                Loading
              </span>
            ) : null}
          </div>

          {!isLoading && reminders.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-xs text-muted-foreground">
              No reminders yet.
            </div>
          ) : null}

          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="rounded-md border border-border bg-secondary/35 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatDateTime(reminder.remindAt)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{reminder.message}</p>
                  {reminder.sentAt ? (
                    <Badge variant="success" className="mt-2">
                      Sent
                    </Badge>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void handleDeleteReminder(reminder.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function getDefaultReminderValue(caseRecord: CaseRecord) {
  const targetDate = caseRecord.deadline
    ? new Date(caseRecord.deadline)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (caseRecord.deadline) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  targetDate.setHours(9, 0, 0, 0);
  return toDateTimeLocalValue(targetDate);
}

function toDateTimeLocalValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getNoticeClassName(tone: Notice["tone"]) {
  if (tone === "success") {
    return "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100";
  }

  return "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
