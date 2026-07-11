import {
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Headphones
} from "lucide-react";
import {
  getNotificationIconClassName,
  NotificationTypeIcon
} from "@/components/app/notifications/notification-icon";
import {
  formatNotificationDateTime,
  formatNotificationRelativeTime,
  formatNotificationType,
  getNotificationActionLabel
} from "@/components/app/notifications/notification-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppNotification } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface NotificationRowProps {
  isExpanded: boolean;
  isUpdating: boolean;
  notification: AppNotification;
  onMarkRead: (notificationId: string) => Promise<void>;
  onOpenCase: (notification: AppNotification) => Promise<void>;
  onOpenSupport: (notification: AppNotification) => void;
  onToggle: () => void;
}

export function NotificationRow({
  isExpanded,
  isUpdating,
  notification,
  onMarkRead,
  onOpenCase,
  onOpenSupport,
  onToggle
}: NotificationRowProps) {
  const isUnread = !notification.readAt;
  const isSupportNotification = notification.type.startsWith("support.");

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-secondary/30",
        isUnread ? "border-primary/30 bg-primary/5" : null,
        isExpanded ? "border-primary/45" : null
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 p-2 md:gap-2 md:p-3">
        <button
          aria-expanded={isExpanded}
          className="grid min-h-20 min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-3 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[2.75rem_minmax(0,1fr)] md:items-start"
          onClick={onToggle}
          type="button"
        >
          <span className={getNotificationIconClassName(notification.type)}>
            <NotificationTypeIcon type={notification.type} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-words text-sm font-semibold leading-5 text-foreground">
                {notification.title}
              </span>
              {isUnread ? <Badge>New</Badge> : null}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground md:line-clamp-2">
              {notification.body}
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              {formatNotificationRelativeTime(notification.createdAt)}
            </span>
            {notification.case ? (
              <span
                className="mt-2 block truncate text-xs text-muted-foreground"
                title={`${notification.case.platform} · ${notification.case.title}`}
              >
                {notification.case.platform} · {notification.case.title}
              </span>
            ) : null}
          </span>
          <span className="flex items-start gap-2 pt-1 text-xs text-muted-foreground md:hidden">
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isExpanded ? "rotate-180" : null
              )}
              aria-hidden="true"
            />
          </span>
        </button>

        {isUnread ? (
          <Button
            aria-label={`Mark ${notification.title} as read`}
            className="md:hidden"
            disabled={isUpdating}
            onClick={() => {
              void onMarkRead(notification.id);
            }}
            size="icon"
            title={`Mark ${notification.title} as read`}
            type="button"
            variant="ghost"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <span
            className="flex h-11 w-11 items-center justify-center text-teal-100 md:hidden"
            title="Read"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Read</span>
          </span>
        )}
      </div>

      {isExpanded ? (
        <div className="grid gap-4 border-t border-border px-3 py-4 md:hidden">
          <div className="grid gap-3">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {formatNotificationType(notification.type)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Received</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {formatNotificationDateTime(notification.createdAt)}
                </dd>
              </div>
            </dl>
            {notification.case ? (
              <div className="border-l-2 border-primary/50 pl-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  Related case
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {notification.case.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{notification.case.platform}</p>
              </div>
            ) : null}
          </div>
          {isSupportNotification ? (
            <Button
              className="w-full md:w-auto"
              onClick={() => onOpenSupport(notification)}
              size="sm"
              type="button"
            >
              <Headphones className="h-4 w-4" aria-hidden="true" />
              {getNotificationActionLabel(notification.type)}
            </Button>
          ) : notification.case ? (
            <Button
              className="w-full md:w-auto"
              onClick={() => {
                void onOpenCase(notification);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
              {getNotificationActionLabel(notification.type)}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
