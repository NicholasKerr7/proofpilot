export type NotificationDeliveryChannel = "email" | "in_app";

export interface NotificationChannelPreference {
  categoryEnabled?: boolean;
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
}

export interface NotificationEventInput {
  body: string;
  caseId: string | null;
  title: string;
  type: string;
  userId: string;
}

export function buildNotificationDelivery(input: {
  event: NotificationEventInput;
  now?: Date;
  preference: NotificationChannelPreference | null;
}) {
  if (input.preference?.categoryEnabled === false) {
    return null;
  }

  const channels: NotificationDeliveryChannel[] = [];
  const inAppVisible = input.preference?.inAppNotifications !== false;
  const emailEnabled = input.preference?.emailNotifications !== false;

  if (inAppVisible) {
    channels.push("in_app");
  }

  if (emailEnabled) {
    channels.push("email");
  }

  if (!channels.length) {
    return null;
  }

  const now = input.now ?? new Date();

  return {
    channels,
    data: {
      ...input.event,
      emailNextAttemptAt: emailEnabled ? now : null,
      emailStatus: emailEnabled ? ("PENDING" as const) : null,
      inAppVisible
    }
  };
}
