import {
  AlarmClock,
  Bell,
  BriefcaseBusiness,
  FileArchive,
  FileWarning,
  TriangleAlert
} from "lucide-react";

export function NotificationTypeIcon({ type }: { type: string }) {
  if (type === "packet_ready") {
    return <FileArchive className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "packet_failed") {
    return <TriangleAlert className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "processing_failed") {
    return <FileWarning className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "deadline_reminder") {
    return <AlarmClock className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "demo_case_ready") {
    return <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />;
  }

  return <Bell className="h-5 w-5" aria-hidden="true" />;
}

export function getNotificationIconClassName(type: string) {
  if (type === "packet_ready") {
    return "flex h-11 w-11 items-center justify-center rounded-md border border-teal-400/25 bg-teal-400/10 text-teal-100";
  }

  if (type.endsWith("_failed")) {
    return "flex h-11 w-11 items-center justify-center rounded-md border border-red-400/25 bg-red-400/10 text-red-100";
  }

  if (type === "deadline_reminder") {
    return "flex h-11 w-11 items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  return "flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary";
}
