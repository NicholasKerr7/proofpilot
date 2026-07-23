"use client";

import dynamic from "next/dynamic";

/** Shared fallback keeps route-level panel transitions stable during code-split loading. */
function WorkspacePanelLoading() {
  return (
    <div
      aria-label="Loading workspace"
      className="grid min-h-72 gap-4 rounded-md border border-border bg-card p-5"
      role="status"
    >
      <div className="h-7 w-44 rounded bg-secondary motion-safe:animate-pulse" />
      <div className="h-24 rounded bg-secondary/70 motion-safe:animate-pulse" />
      <div className="h-24 rounded bg-secondary/45 motion-safe:animate-pulse" />
    </div>
  );
}

export const AccountPanel = dynamic(
  () => import("@/components/app/account/account-panel").then((module) => module.AccountPanel),
  { loading: WorkspacePanelLoading }
);
export const AssistantPanel = dynamic(
  () =>
    import("@/components/app/assistant/assistant-panel").then(
      (module) => module.AssistantPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const BillingPanel = dynamic(
  () => import("@/components/app/billing/billing-panel").then((module) => module.BillingPanel),
  { loading: WorkspacePanelLoading }
);
export const CalendarDeadlinesPanel = dynamic(
  () =>
    import("@/components/app/calendar-deadlines-panel").then(
      (module) => module.CalendarDeadlinesPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const CaseCollaborationPanel = dynamic(
  () =>
    import("@/components/app/collaboration/case-collaboration-panel").then(
      (module) => module.CaseCollaborationPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const CaseDashboard = dynamic(
  () => import("@/components/app/case-dashboard").then((module) => module.CaseDashboard),
  { loading: WorkspacePanelLoading }
);
export const CaseWorkspace = dynamic(
  () => import("@/components/app/case-workspace").then((module) => module.CaseWorkspace),
  { loading: WorkspacePanelLoading }
);
export const CollaborationInvitationPanel = dynamic(
  () =>
    import("@/components/app/collaboration/collaboration-invitation-panel").then(
      (module) => module.CollaborationInvitationPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const ConnectedAccountsPanel = dynamic(
  () =>
    import("@/components/app/connections/connected-accounts-panel").then(
      (module) => module.ConnectedAccountsPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const CreateCaseForm = dynamic(
  () => import("@/components/app/create-case-form").then((module) => module.CreateCaseForm),
  { loading: WorkspacePanelLoading }
);
export const EvidenceUploadView = dynamic(
  () =>
    import("@/components/app/evidence-upload-view").then(
      (module) => module.EvidenceUploadView
    ),
  { loading: WorkspacePanelLoading }
);
export const HelpCenterPanel = dynamic(
  () =>
    import("@/components/app/help/help-center-panel").then(
      (module) => module.HelpCenterPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const HomeDashboard = dynamic(
  () => import("@/components/app/home-dashboard").then((module) => module.HomeDashboard),
  { loading: WorkspacePanelLoading }
);
export const InboxPanel = dynamic(
  () => import("@/components/app/inbox/inbox-panel").then((module) => module.InboxPanel),
  { loading: WorkspacePanelLoading }
);
export const MoreMenu = dynamic(
  () => import("@/components/app/more-menu").then((module) => module.MoreMenu),
  { loading: WorkspacePanelLoading }
);
export const NotificationCenter = dynamic(
  () =>
    import("@/components/app/notification-center").then(
      (module) => module.NotificationCenter
    ),
  { loading: WorkspacePanelLoading }
);
export const PacketSharePanel = dynamic(
  () =>
    import("@/components/app/packet-sharing/packet-share-panel").then(
      (module) => module.PacketSharePanel
    ),
  { loading: WorkspacePanelLoading }
);
export const ReportsPanel = dynamic(
  () => import("@/components/app/reports/reports-panel").then((module) => module.ReportsPanel),
  { loading: WorkspacePanelLoading }
);
export const SearchPanel = dynamic(
  () => import("@/components/app/search/search-panel").then((module) => module.SearchPanel),
  { loading: WorkspacePanelLoading }
);
export const SecurityPrivacyPanel = dynamic(
  () =>
    import("@/components/app/security/security-privacy-panel").then(
      (module) => module.SecurityPrivacyPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const SettingsPanel = dynamic(
  () =>
    import("@/components/app/settings/settings-panel").then(
      (module) => module.SettingsPanel
    ),
  { loading: WorkspacePanelLoading }
);
export const TasksPanel = dynamic(
  () => import("@/components/app/tasks/tasks-panel").then((module) => module.TasksPanel),
  { loading: WorkspacePanelLoading }
);
