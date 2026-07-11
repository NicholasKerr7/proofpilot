import type { AppNotification } from "@/lib/client/types";

export type NotificationFilter = "all" | "unread" | "cases" | "packets" | "system";

export type NotificationGroup = {
  key: "today" | "week" | "earlier";
  label: string;
  notifications: AppNotification[];
};

export function matchesNotificationFilter(
  notification: AppNotification,
  filter: NotificationFilter
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "unread") {
    return !notification.readAt;
  }

  if (filter === "packets") {
    return notification.type.startsWith("packet_");
  }

  if (filter === "system") {
    return (
      notification.type.startsWith("processing_") ||
      notification.type.startsWith("demo_") ||
      !notification.case
    );
  }

  return Boolean(notification.case) && !notification.type.startsWith("packet_");
}

export function groupNotificationsByRecency(
  notifications: AppNotification[],
  now = new Date()
): NotificationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const groups: NotificationGroup[] = [
    { key: "today", label: "Today", notifications: [] },
    { key: "week", label: "This week", notifications: [] },
    { key: "earlier", label: "Earlier", notifications: [] }
  ];

  for (const notification of notifications) {
    const createdAt = new Date(notification.createdAt).getTime();

    if (createdAt >= startOfToday) {
      groups[0].notifications.push(notification);
    } else if (createdAt >= startOfWeek) {
      groups[1].notifications.push(notification);
    } else {
      groups[2].notifications.push(notification);
    }
  }

  return groups.filter((group) => group.notifications.length > 0);
}

export function formatNotificationRelativeTime(value: string, now = new Date()) {
  const createdAt = new Date(value);
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / (60 * 1000))
  );

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  }).format(createdAt);
}

export function formatNotificationDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatNotificationType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getNotificationDestination(type: string) {
  if (type.startsWith("packet_")) {
    return "packet-export";
  }

  if (type.startsWith("processing_")) {
    return "evidence-intake";
  }

  if (type === "deadline_reminder") {
    return "evidence-checklist";
  }

  return "case-overview";
}

export function getNotificationActionLabel(type: string) {
  if (type.startsWith("packet_")) {
    return "Open packet";
  }

  if (type.startsWith("processing_")) {
    return "Review evidence";
  }

  if (type === "deadline_reminder") {
    return "Review checklist";
  }

  return "Open case";
}
