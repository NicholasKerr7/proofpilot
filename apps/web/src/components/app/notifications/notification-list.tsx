import { NotificationRow } from "@/components/app/notifications/notification-row";
import { groupNotificationsByRecency } from "@/components/app/notifications/notification-utils";
import type { AppNotification } from "@/lib/client/types";

interface NotificationListProps {
  expandedNotificationId: string | null;
  isLoading: boolean;
  notifications: AppNotification[];
  onMarkRead: (notificationId: string) => Promise<void>;
  onOpenCase: (notification: AppNotification) => Promise<void>;
  onOpenSupport: (notification: AppNotification) => void;
  onToggleNotification: (notificationId: string) => void;
  updatingNotificationId: string | null;
}

export function NotificationList({
  expandedNotificationId,
  isLoading,
  notifications,
  onMarkRead,
  onOpenCase,
  onOpenSupport,
  onToggleNotification,
  updatingNotificationId
}: NotificationListProps) {
  if (!isLoading && !notifications.length) {
    return (
      <p className="rounded-md border border-dashed border-border bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">
        No inbox items match this search or filter.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {groupNotificationsByRecency(notifications).map((group) => (
        <section key={group.key} aria-labelledby={`notification-group-${group.key}`} className="grid gap-2">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
            <h4
              id={`notification-group-${group.key}`}
              className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
            >
              {group.label}
            </h4>
            <span className="text-xs text-muted-foreground">{group.notifications.length}</span>
          </div>
          <div className="grid gap-2">
            {group.notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                isExpanded={expandedNotificationId === notification.id}
                isUpdating={updatingNotificationId === notification.id}
                notification={notification}
                onMarkRead={onMarkRead}
                onOpenCase={onOpenCase}
                onOpenSupport={onOpenSupport}
                onToggle={() => onToggleNotification(notification.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
