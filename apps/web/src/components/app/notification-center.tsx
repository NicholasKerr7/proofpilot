"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { AppNotification } from "@/lib/client/types";

interface NotificationCenterProps {
  refreshKey: number;
}

type Notice = {
  tone: "error" | "success";
  text: string;
};

export function NotificationCenter({ refreshKey }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextNotifications = await apiRequest<AppNotification[]>("/api/notifications");

        if (isMounted) {
          setNotifications(nextNotifications);
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Notifications could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  async function handleMarkRead(notificationId: string) {
    setNotice(null);

    try {
      const updatedNotification = await apiRequest<AppNotification>(
        `/api/notifications/${notificationId}/read`,
        {
          method: "PATCH"
        }
      );
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === updatedNotification.id ? updatedNotification : notification
        )
      );
      setNotice({ tone: "success", text: "Notification marked read." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Notification could not be updated."
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Deadline reminders, packet readiness, and processing alerts.</CardDescription>
          </div>
          <Badge variant={unreadCount ? "default" : "secondary"}>
            {unreadCount ? `${unreadCount} unread` : "All caught up"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {notice ? <p className={getNoticeClassName(notice.tone)}>{notice.text}</p> : null}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/35 px-3 py-3 text-sm text-muted-foreground">
            <RefreshCcw className="h-4 w-4" />
            Loading notifications
          </div>
        ) : null}

        {!isLoading && notifications.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-sm text-muted-foreground">
            No notifications yet. Packet and reminder updates will appear here.
          </div>
        ) : null}

        {notifications.slice(0, 5).map((notification) => (
          <div
            key={notification.id}
            className="rounded-md border border-border bg-secondary/35 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Bell className="h-4 w-4 shrink-0 text-primary" />
                  <p className="font-medium text-foreground">{notification.title}</p>
                  {!notification.readAt ? <Badge>New</Badge> : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {notification.case ? `${notification.case.platform} · ` : ""}
                  {formatDateTime(notification.createdAt)}
                </p>
              </div>
              {notification.readAt ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void handleMarkRead(notification.id);
                  }}
                >
                  Mark read
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
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
    month: "short"
  }).format(new Date(value));
}
