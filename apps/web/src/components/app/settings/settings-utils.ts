import type { UserSettings } from "@proofpilot/types";

export function formatSettingsDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatSettingsBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function getNotificationCategorySummary(settings: UserSettings) {
  const enabledCount = [
    settings.notifyCaseUpdates,
    settings.notifyDeadlineReminders,
    settings.notifyEvidenceProcessing,
    settings.notifyPacketReady
  ].filter(Boolean).length;

  if (enabledCount === 4) {
    return "All activity";
  }

  if (!enabledCount) {
    return "None selected";
  }

  return `${enabledCount} of 4 categories`;
}
