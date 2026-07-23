import type {
  AppealSubmissionChannel,
  AppealSubmissionStatus,
  SubmissionUpdateType
} from "@proofpilot/types";

export function formatSubmissionChannel(channel: AppealSubmissionChannel) {
  const labels: Record<AppealSubmissionChannel, string> = {
    EMAIL: "Email",
    FAX: "Fax",
    MAIL: "Mail",
    OTHER: "Other",
    SUPPORT_CHAT: "Support chat",
    WEB_PORTAL: "Web portal"
  };

  return labels[channel];
}

export function formatSubmissionStatus(status: AppealSubmissionStatus) {
  const labels: Record<AppealSubmissionStatus, string> = {
    ACKNOWLEDGED: "Acknowledged",
    ACTION_REQUIRED: "Action required",
    APPROVED: "Approved",
    CLOSED: "Closed",
    DENIED: "Denied",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under review"
  };

  return labels[status];
}

export function formatSubmissionUpdateType(type: SubmissionUpdateType) {
  const labels: Record<SubmissionUpdateType, string> = {
    ACKNOWLEDGEMENT: "Acknowledgement",
    DECISION: "Decision",
    FOLLOW_UP: "Follow-up sent",
    INFORMATION_REQUEST: "Information request",
    NOTE: "Case note",
    STATUS_CHANGE: "Status change"
  };

  return labels[type];
}

export function getSubmissionStatusVariant(status: AppealSubmissionStatus) {
  if (status === "APPROVED") {
    return "success" as const;
  }

  if (status === "DENIED" || status === "CLOSED") {
    return "danger" as const;
  }

  if (status === "ACTION_REQUIRED") {
    return "warning" as const;
  }

  return status === "UNDER_REVIEW" ? ("default" as const) : ("secondary" as const);
}

export function getSubmissionStage(status: AppealSubmissionStatus) {
  if (status === "SUBMITTED") {
    return 1;
  }

  if (status === "ACKNOWLEDGED" || status === "ACTION_REQUIRED") {
    return 2;
  }

  if (status === "UNDER_REVIEW") {
    return 3;
  }

  return 4;
}

export function formatSubmissionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatResponseCountdown(value: string | null) {
  if (!value) {
    return "No response deadline";
  }

  const difference = new Date(value).getTime() - Date.now();
  const dayCount = Math.ceil(Math.abs(difference) / 86_400_000);

  if (Math.abs(difference) < 86_400_000) {
    return difference >= 0 ? "Due within 24 hours" : "Less than 1 day overdue";
  }

  return difference >= 0
    ? `${dayCount} ${dayCount === 1 ? "day" : "days"} remaining`
    : `${dayCount} ${dayCount === 1 ? "day" : "days"} overdue`;
}

export function toLocalDateTimeInput(value: Date) {
  const timezoneOffset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - timezoneOffset).toISOString().slice(0, 16);
}
