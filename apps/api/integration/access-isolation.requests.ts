import { isolationIds } from "./access-isolation.fixtures.js";

export interface RequestSpec {
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  path: string;
}

export const guardedPaths = [
  "/auth/me",
  `/assistant/cases/${isolationIds.case}`,
  "/billing",
  "/cases",
  `/cases/${isolationIds.case}/collaboration`,
  "/connections",
  `/cases/${isolationIds.case}/documents`,
  "/inbox/conversations",
  "/notifications",
  `/cases/${isolationIds.case}/packet-shares/prepare`,
  "/reports/summary",
  "/search?q=fixture",
  "/security",
  "/settings",
  "/support/requests",
  "/tasks"
];

export const crossUserReads = [
  `/cases/${isolationIds.case}`,
  `/cases/${isolationIds.case}/activity`,
  `/cases/${isolationIds.case}/timeline`,
  `/cases/${isolationIds.case}/checklist`,
  `/cases/${isolationIds.case}/statement`,
  `/cases/${isolationIds.case}/packets`,
  `/assistant/cases/${isolationIds.case}`,
  `/cases/${isolationIds.case}/collaboration`,
  `/cases/${isolationIds.case}/documents`,
  `/documents/${isolationIds.document}`,
  `/documents/${isolationIds.document}/processing-status`,
  `/inbox/conversations/NOTIFICATION/${isolationIds.notification}`,
  `/inbox/conversations/SUPPORT_REQUEST/${isolationIds.support}`,
  `/cases/${isolationIds.case}/reminders`,
  `/cases/${isolationIds.case}/packet-shares/prepare`,
  `/support/requests/${isolationIds.support}`,
  `/reports/summary?caseId=${isolationIds.case}`,
  `/reports/export?caseId=${isolationIds.case}`,
  `/search?caseId=${isolationIds.case}&q=fixture`,
  "/billing/invoices/demo-nicholas-invoice-1/download"
];

export const ownerScopedCollections = [
  "/billing",
  "/cases",
  "/connections",
  "/inbox/conversations",
  "/notifications",
  "/reminders",
  "/reports/summary",
  "/search?q=fixture",
  "/security",
  "/settings",
  "/support/requests",
  "/tasks"
];

export function getCrossUserMutations(): RequestSpec[] {
  const futureReminder = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      body: {
        description: "Unauthorized event",
        occurredAt: new Date().toISOString(),
        title: "Unauthorized timeline event"
      },
      method: "POST",
      path: `/cases/${isolationIds.case}/timeline`
    },
    { method: "POST", path: `/cases/${isolationIds.case}/timeline/analyze` },
    {
      body: { eventIds: [isolationIds.event] },
      method: "PUT",
      path: `/cases/${isolationIds.case}/timeline/order`
    },
    {
      body: { title: "Unauthorized event update" },
      method: "PATCH",
      path: `/cases/${isolationIds.case}/timeline/${isolationIds.event}`
    },
    {
      method: "DELETE",
      path: `/cases/${isolationIds.case}/timeline/${isolationIds.event}`
    },
    { method: "POST", path: `/cases/${isolationIds.case}/checklist/analyze` },
    {
      body: { completed: true },
      method: "PATCH",
      path: `/cases/${isolationIds.case}/checklist/${isolationIds.checklist}`
    },
    {
      body: { content: "Unauthorized statement replacement" },
      method: "PUT",
      path: `/cases/${isolationIds.case}/statement`
    },
    {
      body: {
        accountUse: "Unauthorized account use",
        actionDate: "July 20, 2026",
        platformAction: "Unauthorized platform action",
        reasonGiven: "Unauthorized reason",
        requestedOutcome: "Unauthorized outcome",
        supportContact: "Unauthorized support contact",
        supportingDocuments: "Unauthorized documents"
      },
      method: "PUT",
      path: `/cases/${isolationIds.case}/statement/guidance`
    },
    { method: "POST", path: `/cases/${isolationIds.case}/statement/generate` },
    {
      method: "POST",
      path: `/cases/${isolationIds.case}/statement/versions/${isolationIds.statementVersion}/restore`
    },
    { method: "POST", path: `/cases/${isolationIds.case}/summary/generate` },
    { method: "POST", path: `/cases/${isolationIds.case}/packet/generate` },
    {
      body: { content: "Summarize this foreign case" },
      method: "POST",
      path: `/assistant/cases/${isolationIds.case}/messages`
    },
    {
      body: { email: "unauthorized-collaborator@proofpilot.test", role: "VIEWER" },
      method: "POST",
      path: `/cases/${isolationIds.case}/collaboration/invitations`
    },
    {
      body: { role: "EDITOR" },
      method: "PATCH",
      path: `/cases/${isolationIds.case}/collaboration/collaborators/${isolationIds.collaborator}`
    },
    {
      method: "DELETE",
      path: `/cases/${isolationIds.case}/collaboration/collaborators/${isolationIds.collaborator}`
    },
    {
      body: { invitationExpiryDays: 14, preventDownloads: true },
      method: "PATCH",
      path: `/cases/${isolationIds.case}/collaboration/settings`
    },
    {
      body: {
        byteSize: 1024,
        mimeType: "application/pdf",
        originalName: "unauthorized.pdf"
      },
      method: "POST",
      path: `/cases/${isolationIds.case}/documents`
    },
    { method: "POST", path: `/documents/${isolationIds.document}/complete` },
    { method: "POST", path: `/documents/${isolationIds.document}/reprocess` },
    { method: "DELETE", path: `/documents/${isolationIds.document}` },
    {
      body: { message: "Unauthorized reminder", remindAt: futureReminder },
      method: "POST",
      path: `/cases/${isolationIds.case}/reminders`
    },
    {
      body: { completed: true, message: "Unauthorized reminder update" },
      method: "PATCH",
      path: `/reminders/${isolationIds.reminder}`
    },
    { method: "DELETE", path: `/reminders/${isolationIds.reminder}` },
    {
      body: { read: true },
      method: "PATCH",
      path: `/inbox/conversations/NOTIFICATION/${isolationIds.notification}/read`
    },
    {
      body: { read: true },
      method: "PATCH",
      path: `/inbox/conversations/SUPPORT_REQUEST/${isolationIds.support}/read`
    },
    {
      body: {
        description: "Unauthorized foreign task",
        priority: "HIGH",
        title: "Unauthorized task"
      },
      method: "POST",
      path: `/cases/${isolationIds.case}/tasks`
    },
    {
      body: { progress: 100, status: "COMPLETED" },
      method: "PATCH",
      path: `/tasks/${isolationIds.task}`
    },
    { method: "DELETE", path: `/tasks/${isolationIds.task}` },
    { method: "PATCH", path: `/notifications/${isolationIds.notification}/read` },
    {
      body: {
        packetExportId: isolationIds.export,
        recipients: [{ email: "reviewer@proofpilot.test", permission: "VIEW" }],
        requireEmailVerification: false,
        watermarkDocuments: false
      },
      method: "POST",
      path: `/cases/${isolationIds.case}/packet-shares`
    },
    {
      method: "DELETE",
      path: `/cases/${isolationIds.case}/packet-shares/${isolationIds.share}`
    },
    {
      body: {
        caseId: isolationIds.case,
        category: "CASE_ASSISTANCE",
        message: "Unauthorized support request for a foreign case.",
        priority: "NORMAL",
        subject: "Unauthorized foreign case request"
      },
      method: "POST",
      path: "/support/requests"
    },
    {
      body: { message: "Unauthorized support follow-up" },
      method: "POST",
      path: `/support/requests/${isolationIds.support}/messages`
    },
    {
      body: { title: "Unauthorized case update" },
      method: "PATCH",
      path: `/cases/${isolationIds.case}`
    },
    { method: "DELETE", path: `/cases/${isolationIds.case}` }
  ];
}
