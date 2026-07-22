import type {
  CaseActivityCategory,
  CaseActivityItem,
  CaseActivityItemCategory
} from "@proofpilot/types";

interface AuditLogRecord {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
}

type ActivityActionFilter =
  | { in: string[] }
  | { startsWith: string };

const caseActions = [
  "case.created",
  "case.updated",
  "case.archived",
  "case.task_created",
  "case.task_updated",
  "case.task_deleted",
  "report.csv_exported",
  "support.request_created",
  "demo.seeded"
];

export function getCaseActivityActionFilter(
  category: CaseActivityCategory
): ActivityActionFilter | undefined {
  switch (category) {
    case "case":
      return { in: caseActions };
    case "evidence":
      return { startsWith: "document." };
    case "timeline":
      return { startsWith: "case.timeline_" };
    case "checklist":
      return { startsWith: "case.checklist_" };
    case "statement":
      return { startsWith: "case.statement_" };
    case "packet":
      return { startsWith: "case.packet_" };
    case "reminder":
      return { startsWith: "case.reminder_" };
    default:
      return undefined;
  }
}

export function toCaseActivityItem(log: AuditLogRecord): CaseActivityItem {
  const metadata = getMetadata(log.metadata);
  const presentation = getActivityPresentation(log.action, metadata);

  return {
    id: log.id,
    action: log.action,
    category: presentation.category,
    title: presentation.title,
    detail: presentation.detail,
    createdAt: log.createdAt.toISOString()
  };
}

interface ActivityPresentation {
  category: CaseActivityItemCategory;
  title: string;
  detail: string | null;
}

function getActivityPresentation(
  action: string,
  metadata: Record<string, unknown>
): ActivityPresentation {
  switch (action) {
    case "case.created":
      return activity("case", "Case created", getCaseCreatedDetail(metadata));
    case "case.updated":
      return activity("case", "Case details updated", getUpdatedFieldsDetail(metadata));
    case "case.archived":
      return activity("case", "Case archived", readString(metadata, "title"));
    case "case.task_created":
      return activity("case", "Task added", getTaskStateDetail(metadata));
    case "case.task_updated":
      return activity("case", "Task updated", getTaskStateDetail(metadata));
    case "case.task_deleted":
      return activity("case", "Task removed", null);
    case "report.csv_exported":
      return activity("case", "CSV report exported", getReportRowDetail(metadata));
    case "support.request_created":
      return activity("case", "Support request sent", readString(metadata, "subject"));
    case "demo.seeded":
      return activity("case", "Demo workspace prepared", readString(metadata, "title"));
    case "document.created_upload_url":
      return activity("evidence", "Evidence upload started", getDocumentName(metadata));
    case "document.upload_completed":
      return activity("evidence", "Document uploaded", getDocumentName(metadata));
    case "document.reprocess_requested":
      return activity("evidence", "Document reprocessing requested", getDocumentName(metadata));
    case "document.deleted":
      return activity("evidence", "Document removed", getDocumentName(metadata));
    case "document.upload_rejected":
      return activity("evidence", "Document upload rejected", getDocumentName(metadata));
    case "document.virus_scan_completed":
      return activity("evidence", "Upload security scan passed", getDocumentName(metadata));
    case "document.virus_scan_skipped":
      return activity("evidence", "Upload security scan skipped", getDocumentName(metadata));
    case "document.virus_scan_failed":
      return activity("evidence", "Upload security check failed", getDocumentName(metadata));
    case "document.virus_detected":
      return activity("evidence", "Unsafe upload blocked", getDocumentName(metadata));
    case "document.processing_failed":
      return activity("evidence", "Document processing failed", getDocumentName(metadata));
    case "case.timeline_event_created":
      return activity("timeline", "Timeline event added", readString(metadata, "title"));
    case "case.timeline_event_updated":
      return activity("timeline", "Timeline event updated", readString(metadata, "title"));
    case "case.timeline_event_deleted":
      return activity("timeline", "Timeline event removed", readString(metadata, "title"));
    case "case.timeline_reordered":
      return activity("timeline", "Timeline reordered", null);
    case "case.timeline_analyzed":
      return activity("timeline", "Timeline rebuilt", getTimelineAnalysisDetail(metadata));
    case "case.checklist_analyzed":
      return activity("checklist", "Evidence checklist analyzed", getChecklistDetail(metadata));
    case "case.checklist_auto_analyzed":
      return activity("checklist", "Evidence checklist refreshed", getChecklistDetail(metadata));
    case "case.checklist_item_completed":
      return activity("checklist", "Checklist item completed", readString(metadata, "label"));
    case "case.checklist_item_reopened":
      return activity("checklist", "Checklist item reopened", readString(metadata, "label"));
    case "case.statement_generated":
      return activity("statement", "Statement draft generated", getVersionDetail(metadata));
    case "case.statement_guidance_saved":
      return activity("statement", "Guided answers saved", getGuidanceDetail(metadata));
    case "case.statement_restored":
      return activity("statement", "Statement version restored", getRestoredVersionDetail(metadata));
    case "case.statement_saved":
      return activity("statement", "Statement draft saved", getVersionDetail(metadata));
    case "case.statement_summary_generated":
      return activity("statement", "Case summary generated", getSummaryDetail(metadata));
    case "case.packet_generation_queued":
      return activity("packet", "Packet generation started", null);
    case "case.packet_generated":
      return activity("packet", "Packet generated", getPacketSizeDetail(metadata));
    case "case.packet_share_created":
      return activity("packet", "Packet share link created", getPacketShareDetail(metadata));
    case "case.packet_share_revoked":
      return activity("packet", "Packet share link revoked", null);
    case "case.packet_generation_failed":
    case "case.packet_generation_queue_failed":
      return activity("packet", "Packet generation failed", "The packet can be retried.");
    case "case.reminder_created":
      return activity("reminder", "Reminder scheduled", "A case review reminder was added.");
    case "case.reminder_deleted":
      return activity("reminder", "Reminder removed", readString(metadata, "message"));
    case "case.reminder_sent":
      return activity("reminder", "Reminder sent", "The scheduled case reminder became due.");
    default:
      return activity(getFallbackCategory(action), formatUnknownAction(action), null);
  }
}

function activity(
  category: CaseActivityItemCategory,
  title: string,
  detail: string | null
): ActivityPresentation {
  return { category, title, detail };
}

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getCaseCreatedDetail(metadata: Record<string, unknown>) {
  const title = readString(metadata, "title");
  const platform = readString(metadata, "platform");

  if (title && platform) {
    return `${title} on ${platform}`;
  }

  return title ?? (platform ? `${platform} case` : null);
}

function getUpdatedFieldsDetail(metadata: Record<string, unknown>) {
  const allowedFields = ["title", "platform", "summary", "deadline", "status"];
  const fields = allowedFields.filter((field) => field in metadata);

  if (!fields.length) {
    return null;
  }

  return `${fields.map(formatFieldName).join(", ")} changed`;
}

function getTaskStateDetail(metadata: Record<string, unknown>) {
  const status = readString(metadata, "status");
  const priority = readString(metadata, "priority");

  if (status && priority) {
    return `${formatEnumValue(status)}, ${formatEnumValue(priority)} priority`;
  }

  return status ? formatEnumValue(status) : null;
}

function getDocumentName(metadata: Record<string, unknown>) {
  return readString(metadata, "originalName");
}

function getTimelineAnalysisDetail(metadata: Record<string, unknown>) {
  const eventCount = readNumber(metadata, "eventCount");
  const documentCount = readNumber(metadata, "documentsAnalyzed");

  if (eventCount === null || documentCount === null) {
    return null;
  }

  return `${eventCount} ${eventCount === 1 ? "event" : "events"} from ${documentCount} ${
    documentCount === 1 ? "document" : "documents"
  }`;
}

function getChecklistDetail(metadata: Record<string, unknown>) {
  const foundCount = readNumber(metadata, "foundCount");
  const missingCount = readNumber(metadata, "missingCount");

  if (foundCount === null || missingCount === null) {
    return null;
  }

  return `${foundCount} found, ${missingCount} missing`;
}

function getVersionDetail(metadata: Record<string, unknown>) {
  const version = readNumber(metadata, "version");
  return version === null ? null : `Version ${version}`;
}

function getReportRowDetail(metadata: Record<string, unknown>) {
  const rowCount = readNumber(metadata, "rowCount");

  if (rowCount === null) {
    return null;
  }

  return `${rowCount} ${rowCount === 1 ? "case row" : "case rows"}`;
}

function getPacketSizeDetail(metadata: Record<string, unknown>) {
  const byteSize = readNumber(metadata, "byteSize");

  if (byteSize === null) {
    return null;
  }

  return `${new Intl.NumberFormat("en-US").format(byteSize)} bytes`;
}

function getPacketShareDetail(metadata: Record<string, unknown>) {
  const recipientCount = readNumber(metadata, "recipientCount");

  if (recipientCount === null) {
    return null;
  }

  return `${recipientCount} ${recipientCount === 1 ? "recipient" : "recipients"}`;
}

function readString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getGuidanceDetail(metadata: Record<string, unknown>) {
  const answeredCount = readNumber(metadata, "answeredCount");
  return answeredCount === null ? null : `${answeredCount} of 7 prompts answered`;
}

function getRestoredVersionDetail(metadata: Record<string, unknown>) {
  const sourceVersion = readNumber(metadata, "restoredFromVersion");
  return sourceVersion === null ? getVersionDetail(metadata) : `Restored from version ${sourceVersion}`;
}

function getSummaryDetail(metadata: Record<string, unknown>) {
  const documentCount = readNumber(metadata, "documentCount");
  const eventCount = readNumber(metadata, "eventCount");

  if (documentCount === null || eventCount === null) {
    return null;
  }

  return `${documentCount} evidence files and ${eventCount} timeline events reviewed`;
}

function formatFieldName(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatEnumValue(value: string) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getFallbackCategory(action: string): CaseActivityItemCategory {
  if (action.startsWith("document.")) {
    return "evidence";
  }

  if (action.includes("timeline")) {
    return "timeline";
  }

  if (action.includes("checklist")) {
    return "checklist";
  }

  if (action.includes("statement")) {
    return "statement";
  }

  if (action.includes("packet")) {
    return "packet";
  }

  if (action.includes("reminder")) {
    return "reminder";
  }

  return "case";
}

function formatUnknownAction(action: string) {
  return action
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
