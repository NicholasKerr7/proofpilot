import { BriefcaseBusiness, Check, Inbox } from "lucide-react";
import {
  getNotificationIconClassName,
  NotificationTypeIcon
} from "@/components/app/notifications/notification-icon";
import {
  formatNotificationDateTime,
  formatNotificationType,
  getNotificationActionLabel
} from "@/components/app/notifications/notification-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppNotification } from "@/lib/client/types";

interface NotificationDetailProps {
  isUpdating: boolean;
  notification: AppNotification | null;
  onMarkRead: (notificationId: string) => Promise<void>;
  onOpenCase: (notification: AppNotification) => Promise<void>;
}

export function NotificationDetail({
  isUpdating,
  notification,
  onMarkRead,
  onOpenCase
}: NotificationDetailProps) {
  if (!notification) {
    return (
      <aside className="hidden min-h-96 content-center justify-items-center gap-3 border-l border-border px-6 text-center md:grid">
        <span className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-secondary/30 text-muted-foreground">
          <Inbox aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h4 className="font-semibold text-foreground">Select an inbox item</h4>
          <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
            Open a case update, deadline, packet result, or processing alert.
          </p>
        </div>
      </aside>
    );
  }

  const isUnread = !notification.readAt;

  return (
    <aside
      aria-labelledby="notification-detail-heading"
      className="hidden min-h-96 content-start gap-5 border-l border-border pl-5 md:grid"
    >
      <div className="flex items-start gap-3">
        <span className={getNotificationIconClassName(notification.type)}>
          <NotificationTypeIcon type={notification.type} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isUnread ? "default" : "secondary"}>
              {isUnread ? "Unread" : "Read"}
            </Badge>
            <Badge variant="secondary">{formatNotificationType(notification.type)}</Badge>
          </div>
          <h4
            className="mt-3 break-words text-lg font-semibold leading-7 text-foreground"
            id="notification-detail-heading"
          >
            {notification.title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNotificationDateTime(notification.createdAt)}
          </p>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
        {notification.body}
      </p>

      {notification.case ? (
        <section aria-labelledby="notification-related-case" className="border-y border-border py-4">
          <p
            className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
            id="notification-related-case"
          >
            Related case
          </p>
          <p className="mt-2 font-medium text-foreground">{notification.case.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{notification.case.platform}</p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isUnread ? (
          <Button
            disabled={isUpdating}
            onClick={() => {
              void onMarkRead(notification.id);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            {isUpdating ? "Updating..." : "Mark read"}
          </Button>
        ) : null}
        {notification.case ? (
          <Button
            onClick={() => {
              void onOpenCase(notification);
            }}
            size="sm"
            type="button"
          >
            <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />
            {getNotificationActionLabel(notification.type)}
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
