import type { CaseRecord, CaseReminder } from "@/lib/client/types";

export type ReminderFilter = "upcoming" | "sent" | "all";

export function matchesReminderFilter(reminder: CaseReminder, filter: ReminderFilter) {
  if (filter === "all") {
    return true;
  }

  return filter === "sent" ? Boolean(reminder.sentAt) : !reminder.sentAt;
}

export function sortReminders(reminders: CaseReminder[]) {
  return [...reminders].sort(
    (first, second) =>
      new Date(first.remindAt).getTime() - new Date(second.remindAt).getTime()
  );
}

export function getReminderStatus(reminder: CaseReminder, now = new Date()) {
  if (reminder.sentAt) {
    return "sent" as const;
  }

  if (new Date(reminder.remindAt).getTime() < now.getTime()) {
    return "overdue" as const;
  }

  return "upcoming" as const;
}

export function formatReminderDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatReminderTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatReminderDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatReminderRelativeTime(value: string, now = new Date()) {
  const target = new Date(value);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  const dayDifference = Math.round((startOfTarget - startOfToday) / (24 * 60 * 60 * 1000));

  if (dayDifference < 0) {
    return `${Math.abs(dayDifference)}d overdue`;
  }

  if (dayDifference === 0) {
    return "Today";
  }

  if (dayDifference === 1) {
    return "Tomorrow";
  }

  if (dayDifference < 7) {
    return `In ${dayDifference} days`;
  }

  return formatReminderDate(value);
}

export function getDefaultReminderValue(caseRecord: CaseRecord, now = new Date()) {
  const targetDate = caseRecord.deadline
    ? new Date(caseRecord.deadline)
    : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (caseRecord.deadline) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  targetDate.setHours(9, 0, 0, 0);

  if (targetDate.getTime() <= now.getTime()) {
    targetDate.setTime(now.getTime());
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(9, 0, 0, 0);
  }

  return toDateTimeLocalValue(targetDate);
}

function toDateTimeLocalValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
