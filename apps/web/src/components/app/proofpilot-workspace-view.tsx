"use client";

import {
  defaultUserSettingsValues,
  type GlobalSearchResult,
  type UpdateUserSettingsInput,
  type UserSettings
} from "@proofpilot/types";
import type { AccountSection } from "@/components/app/account/account-panel";
import type { AppView } from "@/components/app/app-shell";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import {
  AccountPanel,
  AssistantPanel,
  BillingPanel,
  CalendarDeadlinesPanel,
  CaseCollaborationPanel,
  CaseDashboard,
  CaseWorkspace,
  ConnectedAccountsPanel,
  CreateCaseForm,
  EvidenceUploadView,
  HelpCenterPanel,
  HomeDashboard,
  InboxPanel,
  MoreMenu,
  NotificationCenter,
  PacketSharePanel,
  ReportsPanel,
  SearchPanel,
  SecurityPrivacyPanel,
  SettingsPanel,
  TasksPanel
} from "@/components/app/proofpilot-workspace-panels";
import type {
  AppNotification,
  AuthUser,
  CaseRecord,
  CaseType,
  CreateCasePayload
} from "@/lib/client/types";

interface ProofPilotWorkspaceViewProps {
  accountSection: AccountSection;
  activeCaseDestinationId: CaseDestinationId;
  activeView: AppView;
  cases: CaseRecord[];
  caseTypes: CaseType[];
  helpInitialRequestId: string | null;
  helpInitialView: "home" | "contact";
  inboxRefreshKey: number;
  isCaseLoading: boolean;
  isSubmitting: boolean;
  message: string | null;
  notificationRefreshKey: number;
  onArchiveCase: (caseId: string) => Promise<boolean>;
  onCaseChanged: (caseId: string) => Promise<CaseRecord>;
  onClosePacketShare: () => void;
  onCreateCase: (payload: CreateCasePayload) => Promise<boolean>;
  onInboxChanged: () => void;
  onNavigate: (view: AppView) => void;
  onNavigateCaseDestination: (destinationId: CaseDestinationId) => void;
  onNotificationsChanged: () => void;
  onOpenAccount: (section: AccountSection) => void;
  onOpenCase: (
    caseId: string,
    destinationId?: CaseDestinationId
  ) => Promise<void>;
  onOpenCollaboration: () => void;
  onOpenPacketShare: () => void;
  onOpenPacketSupport: () => void;
  onOpenSearchResult: (result: GlobalSearchResult) => void;
  onOpenSupport: (notification: AppNotification) => void;
  onSelectAssistantCase: (caseId: string) => Promise<void>;
  onUnreadInboxCountChange: (count: number) => void;
  onUnreadNotificationCountChange: (count: number) => void;
  onUpdateSettings: (input: UpdateUserSettingsInput) => Promise<UserSettings>;
  onUserChanged: (user: AuthUser) => void;
  selectedCase: CaseRecord | null;
  settings: UserSettings | null;
  user: AuthUser;
}

/** Composes the authenticated workspace view selected by the URL route. */
export function ProofPilotWorkspaceView({
  accountSection,
  activeCaseDestinationId,
  activeView,
  cases,
  caseTypes,
  helpInitialRequestId,
  helpInitialView,
  inboxRefreshKey,
  isCaseLoading,
  isSubmitting,
  message,
  notificationRefreshKey,
  onArchiveCase,
  onCaseChanged,
  onClosePacketShare,
  onCreateCase,
  onInboxChanged,
  onNavigate,
  onNavigateCaseDestination,
  onNotificationsChanged,
  onOpenAccount,
  onOpenCase,
  onOpenCollaboration,
  onOpenPacketShare,
  onOpenPacketSupport,
  onOpenSearchResult,
  onOpenSupport,
  onSelectAssistantCase,
  onUnreadInboxCountChange,
  onUnreadNotificationCountChange,
  onUpdateSettings,
  onUserChanged,
  selectedCase,
  settings,
  user
}: ProofPilotWorkspaceViewProps) {
  const confirmBeforeDelete =
    settings?.confirmBeforeDelete ?? defaultUserSettingsValues.confirmBeforeDelete;
  const itemsPerPage =
    settings?.itemsPerPage ?? defaultUserSettingsValues.itemsPerPage;

  return (
    <div className="proof-view-enter grid gap-5" key={activeView}>
      {message ? (
        <p
          className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      {activeView === "home" ? (
        <HomeDashboard
          cases={cases}
          onCreateCase={() => onNavigate("create")}
          onOpenCase={onOpenCase}
          onViewCases={() => onNavigate("cases")}
          primaryCase={selectedCase}
        />
      ) : null}

      {activeView === "cases" ? (
        <CaseDashboard
          cases={cases}
          confirmBeforeDelete={confirmBeforeDelete}
          isLoading={isCaseLoading}
          itemsPerPage={itemsPerPage}
          onArchiveCase={onArchiveCase}
          onCreateCase={() => onNavigate("create")}
          onSelectCase={onOpenCase}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "create" ? (
        <CreateCaseForm
          caseTypes={caseTypes}
          isSubmitting={isSubmitting}
          onCancel={() => onNavigate("cases")}
          onComplete={() => onNavigate("upload")}
          onCreateCase={onCreateCase}
        />
      ) : null}

      {activeView === "case" ? (
        <CaseWorkspace
          activeDestinationId={activeCaseDestinationId}
          confirmBeforeDelete={confirmBeforeDelete}
          onBackToCases={() => onNavigate("cases")}
          onCaseChanged={onCaseChanged}
          onNotificationsChanged={onNotificationsChanged}
          onOpenCollaboration={onOpenCollaboration}
          onOpenPacketShare={onOpenPacketShare}
          onSectionChange={onNavigateCaseDestination}
          portfolioDemo={user.isPortfolioDemo}
          selectedCase={selectedCase}
        />
      ) : null}

      {activeView === "collaboration" &&
      selectedCase &&
      selectedCase.access?.canManage !== false ? (
        <CaseCollaborationPanel
          caseRecord={selectedCase}
          externalInvitesDisabled={user.isPortfolioDemo}
          key={selectedCase.id}
          onBack={() => onNavigate("case")}
        />
      ) : null}

      {activeView === "share-packet" &&
      selectedCase &&
      selectedCase.access?.canManage !== false ? (
        <PacketSharePanel
          caseRecord={selectedCase}
          externalSharingDisabled={user.isPortfolioDemo}
          key={selectedCase.id}
          onBack={onClosePacketShare}
          onDone={onClosePacketShare}
          onOpenSupport={onOpenPacketSupport}
          ownerName={user.name ?? user.email}
        />
      ) : null}

      {activeView === "upload" ? (
        <EvidenceUploadView
          confirmBeforeDelete={confirmBeforeDelete}
          onCaseChanged={onCaseChanged}
          onCreateCase={() => onNavigate("create")}
          onViewCases={() => onNavigate("cases")}
          portfolioDemo={user.isPortfolioDemo}
          selectedCase={selectedCase}
        />
      ) : null}

      {activeView === "assistant" ? (
        <AssistantPanel
          cases={cases}
          onCreateCase={() => onNavigate("create")}
          onOpenCase={onOpenCase}
          onSelectCase={onSelectAssistantCase}
          selectedCase={selectedCase}
          user={user}
        />
      ) : null}

      {activeView === "inbox" ? (
        <InboxPanel
          cases={cases}
          onNotificationsChanged={onNotificationsChanged}
          onOpenCase={(caseId) => {
            void onOpenCase(caseId, "case-overview");
          }}
          onUnreadCountChange={onUnreadInboxCountChange}
          ownerName={user.name ?? user.email}
          refreshKey={inboxRefreshKey}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "notifications" ? (
        <NotificationCenter
          onInboxChanged={onInboxChanged}
          onOpenCase={onOpenCase}
          onOpenSupport={onOpenSupport}
          onUnreadCountChange={onUnreadNotificationCountChange}
          refreshKey={notificationRefreshKey}
        />
      ) : null}

      {activeView === "more" ? (
        <MoreMenu
          onCreateCase={() => onNavigate("create")}
          onOpenAccount={onOpenAccount}
          onOpenAssistant={() => onNavigate("assistant")}
          onOpenBilling={() => onNavigate("billing")}
          onOpenCalendar={() => onNavigate("calendar")}
          onOpenCase={onOpenCase}
          onOpenConnections={() => onNavigate("connections")}
          onOpenHelp={() => onNavigate("help")}
          onOpenNotifications={() => onNavigate("notifications")}
          onOpenReports={() => onNavigate("reports")}
          onOpenSearch={() => onNavigate("search")}
          onOpenSecurity={() => onNavigate("security")}
          onOpenSettings={() => onNavigate("settings")}
          onOpenTasks={() => onNavigate("tasks")}
          onViewCases={() => onNavigate("cases")}
          selectedCase={selectedCase}
          user={user}
        />
      ) : null}

      {activeView === "calendar" ? (
        <CalendarDeadlinesPanel
          cases={cases}
          onOpenCase={onOpenCase}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "tasks" ? (
        <TasksPanel
          cases={cases}
          onOpenCase={(caseId) => {
            void onOpenCase(caseId, "case-overview");
          }}
          ownerName={user.name ?? user.email}
          selectedCase={selectedCase}
        />
      ) : null}

      {activeView === "reports" ? (
        <ReportsPanel
          cases={cases}
          onOpenCase={(caseId) => {
            void onOpenCase(caseId);
          }}
        />
      ) : null}

      {activeView === "help" ? (
        <HelpCenterPanel
          cases={cases}
          initialRequestId={helpInitialRequestId}
          initialView={helpInitialView}
          onSupportRequestCreated={() => {
            onInboxChanged();
            onNotificationsChanged();
          }}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "search" ? (
        <SearchPanel cases={cases} onOpenResult={onOpenSearchResult} />
      ) : null}

      {activeView === "settings" ? (
        <SettingsPanel onUpdate={onUpdateSettings} settings={settings} />
      ) : null}

      {activeView === "security" ? (
        <SecurityPrivacyPanel
          onBack={() => onNavigate("more")}
          onOpenHelp={() => onNavigate("help")}
          onOpenReports={() => onNavigate("reports")}
          onUpdateSettings={onUpdateSettings}
          portfolioDemo={user.isPortfolioDemo}
          settings={settings}
        />
      ) : null}

      {activeView === "connections" ? <ConnectedAccountsPanel /> : null}

      {activeView === "billing" ? (
        <BillingPanel
          onBack={() => onNavigate("more")}
          onOpenHelp={() => onNavigate("help")}
        />
      ) : null}

      {activeView === "account" ? (
        <AccountPanel
          cases={cases}
          onSectionChange={onOpenAccount}
          onUserChanged={onUserChanged}
          section={accountSection}
          user={user}
        />
      ) : null}
    </div>
  );
}
