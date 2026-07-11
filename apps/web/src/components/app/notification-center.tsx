"use client";

import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCheck,
  FileArchive,
  Headphones,
  Inbox,
  RefreshCcw,
  Search,
  Settings2,
  X,
  type LucideIcon
} from "lucide-react";
import { NotificationDetail } from "@/components/app/notifications/notification-detail";
import { NotificationList } from "@/components/app/notifications/notification-list";
import {
  getNotificationDestination,
  matchesNotificationFilter,
  matchesNotificationSearch,
  type NotificationFilter
} from "@/components/app/notifications/notification-utils";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client/api";
import type { AppNotification } from "@/lib/client/types";

const notificationFilters: Array<{
  icon: LucideIcon;
  label: string;
  value: NotificationFilter;
}> = [
  { icon: Inbox, label: "All", value: "all" },
  { icon: CheckCheck, label: "Unread", value: "unread" },
  { icon: BriefcaseBusiness, label: "Cases", value: "cases" },
  { icon: FileArchive, label: "Packets", value: "packets" },
  { icon: Headphones, label: "Support", value: "support" },
  { icon: Settings2, label: "System", value: "system" }
];

interface NotificationCenterProps {
  onOpenCase: (caseId: string, destinationId: CaseDestinationId) => Promise<void>;
  onOpenSupport: (notification: AppNotification) => void;
  refreshKey: number;
}

type Notice = {
  tone: "error" | "success";
  text: string;
};

export function NotificationCenter({
  onOpenCase,
  onOpenSupport,
  refreshKey
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [updatingNotificationId, setUpdatingNotificationId] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const filteredNotifications = notifications.filter(
    (notification) =>
      matchesNotificationFilter(notification, filter) &&
      matchesNotificationSearch(notification, searchQuery)
  );
  const selectedNotification =
    filteredNotifications.find((notification) => notification.id === expandedNotificationId) ??
    null;

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextNotifications = await apiRequest<AppNotification[]>("/api/notifications");

        if (isMounted) {
          const defaultNotificationId = getTabletDefaultNotificationId(
            nextNotifications,
            "all",
            ""
          );
          setNotifications(nextNotifications);
          setExpandedNotificationId((currentId) =>
            currentId && nextNotifications.some((notification) => notification.id === currentId)
              ? currentId
              : defaultNotificationId
          );
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Inbox could not be loaded."
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
    setUpdatingNotificationId(notificationId);
    setNotice(null);

    try {
      const updatedNotification = await markNotificationRead(notificationId);
      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === updatedNotification.id ? updatedNotification : notification
        )
      );
      setNotice({ tone: "success", text: "Inbox item marked read." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Inbox item could not be updated."
      });
    } finally {
      setUpdatingNotificationId(null);
    }
  }

  async function handleMarkAllRead() {
    const unreadNotifications = notifications.filter((notification) => !notification.readAt);

    if (!unreadNotifications.length) {
      return;
    }

    setIsMarkingAllRead(true);
    setNotice(null);

    const results = await Promise.allSettled(
      unreadNotifications.map((notification) => markNotificationRead(notification.id))
    );
    const updatedNotifications = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );
    const updatedById = new Map(
      updatedNotifications.map((notification) => [notification.id, notification])
    );

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => updatedById.get(notification.id) ?? notification)
    );

    const failedCount = results.length - updatedNotifications.length;
    setNotice(
      failedCount
        ? {
            tone: "error",
            text: `${updatedNotifications.length} marked read; ${failedCount} could not be updated.`
          }
        : { tone: "success", text: "All inbox items marked read." }
    );
    setIsMarkingAllRead(false);
  }

  async function handleOpenCase(notification: AppNotification) {
    if (!notification.case) {
      return;
    }

    setNotice(null);

    try {
      const destinationId = getNotificationDestination(notification.type);
      await onOpenCase(notification.case.id, destinationId);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "The related case could not be opened."
      });
    }
  }

  return (
    <Card id="notifications-center" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Inbox</CardTitle>
            <Badge variant={unreadCount ? "default" : "secondary"}>
              {unreadCount ? `${unreadCount} unread` : "All caught up"}
            </Badge>
          </div>
          <CardDescription>
            Support requests, case updates, deadlines, packet results, and processing alerts.
          </CardDescription>
        </div>
        <Button
          disabled={!unreadCount || isMarkingAllRead}
          onClick={() => {
            void handleMarkAllRead();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          {isMarkingAllRead ? "Updating..." : "Mark all read"}
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

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search inbox"
              className="pl-10 pr-12"
              onChange={(event) => {
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);
                setExpandedNotificationId(
                  getTabletDefaultNotificationId(notifications, filter, nextQuery)
                );
              }}
              placeholder="Search inbox"
              type="search"
              value={searchQuery}
            />
            {searchQuery ? (
              <Button
                aria-label="Clear inbox search"
                className="absolute right-0 top-1/2 -translate-y-1/2"
                onClick={() => {
                  setSearchQuery("");
                  setExpandedNotificationId(
                    getTabletDefaultNotificationId(notifications, filter, "")
                  );
                }}
                size="icon"
                title="Clear inbox search"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <Badge className="justify-self-start md:justify-self-auto" variant="secondary">
            {filteredNotifications.length} {filteredNotifications.length === 1 ? "item" : "items"}
          </Badge>
        </div>

        <div
          aria-label="Filter inbox"
          className="flex gap-1 overflow-x-auto rounded-md border border-border bg-secondary/25 p-1 scroll-container md:grid md:grid-cols-6"
          role="group"
        >
          {notificationFilters.map((item) => (
            <Button
              key={item.value}
              aria-pressed={filter === item.value}
              className="shrink-0"
              onClick={() => {
                setFilter(item.value);
                setExpandedNotificationId(
                  getTabletDefaultNotificationId(notifications, item.value, searchQuery)
                );
              }}
              size="sm"
              type="button"
              variant={filter === item.value ? "secondary" : "ghost"}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/25 px-3 py-3 text-sm text-muted-foreground">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Loading inbox
          </div>
        ) : null}

        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1.1fr)] md:items-start">
          <NotificationList
            expandedNotificationId={expandedNotificationId}
            isLoading={isLoading}
            notifications={filteredNotifications}
            onMarkRead={handleMarkRead}
            onOpenCase={handleOpenCase}
            onOpenSupport={onOpenSupport}
            onToggleNotification={(notificationId) =>
              setExpandedNotificationId((currentId) =>
                currentId === notificationId ? null : notificationId
              )
            }
            updatingNotificationId={updatingNotificationId}
          />

          {!isLoading ? (
            <NotificationDetail
              isUpdating={updatingNotificationId === selectedNotification?.id}
              notification={selectedNotification}
              onMarkRead={handleMarkRead}
              onOpenCase={handleOpenCase}
              onOpenSupport={onOpenSupport}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function markNotificationRead(notificationId: string) {
  return apiRequest<AppNotification>(`/api/notifications/${notificationId}/read`, {
    method: "PATCH"
  });
}

function getTabletDefaultNotificationId(
  notifications: AppNotification[],
  filter: NotificationFilter,
  searchQuery: string
) {
  if (!window.matchMedia("(min-width: 768px)").matches) {
    return null;
  }

  return (
    notifications.find(
      (notification) =>
        matchesNotificationFilter(notification, filter) &&
        matchesNotificationSearch(notification, searchQuery)
    )?.id ?? null
  );
}

function getNoticeClassName(tone: Notice["tone"]) {
  return tone === "success"
    ? "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100"
    : "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100";
}
