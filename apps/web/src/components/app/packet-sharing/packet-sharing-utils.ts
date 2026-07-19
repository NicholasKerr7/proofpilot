import type { PacketSharePermission } from "@proofpilot/types";

export function formatPacketShareBytes(value: number | null) {
  if (value === null) {
    return "PDF packet";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPacketShareDate(value: string | null, fallback = "No expiration") {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getPacketSharePermissionLabel(permission: PacketSharePermission) {
  const labels: Record<PacketSharePermission, string> = {
    COMMENT: "View and comment",
    DOWNLOAD: "Download and comment",
    VIEW: "View only"
  };

  return labels[permission];
}
