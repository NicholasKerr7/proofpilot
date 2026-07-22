"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type CaseInvitationDecisionResponse,
  type CaseInvitationPreview,
  defaultUserSettingsValues,
  type GlobalSearchResult,
  type UpdateUserSettingsInput,
  type UserSettings
} from "@proofpilot/types";
import {
  AccountPanel,
  type AccountSection
} from "@/components/app/account/account-panel";
import { AppShell, type AppView } from "@/components/app/app-shell";
import { AssistantPanel } from "@/components/app/assistant/assistant-panel";
import { AuthPanel } from "@/components/app/auth-panel";
import type { AuthMode } from "@/components/app/auth-panel";
import { BillingPanel } from "@/components/app/billing/billing-panel";
import { CaseDashboard } from "@/components/app/case-dashboard";
import { CaseCollaborationPanel } from "@/components/app/collaboration/case-collaboration-panel";
import { CollaborationInvitationPanel } from "@/components/app/collaboration/collaboration-invitation-panel";
import { CaseWorkspace } from "@/components/app/case-workspace";
import { CalendarDeadlinesPanel } from "@/components/app/calendar-deadlines-panel";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { CreateCaseForm } from "@/components/app/create-case-form";
import { ConnectedAccountsPanel } from "@/components/app/connections/connected-accounts-panel";
import { EvidenceUploadView } from "@/components/app/evidence-upload-view";
import { HomeDashboard } from "@/components/app/home-dashboard";
import { HelpCenterPanel } from "@/components/app/help/help-center-panel";
import { InboxPanel } from "@/components/app/inbox/inbox-panel";
import { MoreMenu } from "@/components/app/more-menu";
import { NotificationCenter } from "@/components/app/notification-center";
import { getSupportRequestIdFromNotification } from "@/components/app/notifications/notification-utils";
import { PacketSharePanel } from "@/components/app/packet-sharing/packet-share-panel";
import { PublicLanding } from "@/components/app/public/public-landing";
import { ReportsPanel } from "@/components/app/reports/reports-panel";
import { SearchPanel } from "@/components/app/search/search-panel";
import { SecurityPrivacyPanel } from "@/components/app/security/security-privacy-panel";
import { SettingsPanel } from "@/components/app/settings/settings-panel";
import { TasksPanel } from "@/components/app/tasks/tasks-panel";
import { Badge } from "@/components/ui/badge";
import { apiRequest, ApiClientError } from "@/lib/client/api";
import type {
  AppNotification,
  AuthUser,
  CaseRecord,
  CaseType,
  CreateCasePayload
} from "@/lib/client/types";

const fallbackCaseTypes: CaseType[] = [
  {
    id: "account-ban-appeal",
    slug: "account-ban-appeal",
    name: "Account Ban / Appeal Builder",
    description:
      "Build an organized appeal packet for account bans, holds, closures, and platform restrictions."
  }
];

interface ProofPilotAppProps {
  portfolioMode?: boolean;
}

export function ProofPilotApp({ portfolioMode = false }: ProofPilotAppProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [publicView, setPublicView] = useState<"landing" | "auth">("landing");
  const [publicAuthMode, setPublicAuthMode] = useState<AuthMode>("login");
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<CaseInvitationPreview | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isInvitationLoading, setIsInvitationLoading] = useState(false);
  const [isInvitationSubmitting, setIsInvitationSubmitting] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>(fallbackCaseTypes);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("home");
  const [activeCaseDestinationId, setActiveCaseDestinationId] =
    useState<CaseDestinationId>("case-overview");
  const [accountSection, setAccountSection] = useState<AccountSection>("profile");
  const [helpInitialView, setHelpInitialView] = useState<"home" | "contact">("home");
  const [helpInitialRequestId, setHelpInitialRequestId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCaseLoading, setIsCaseLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inboxRefreshKey, setInboxRefreshKey] = useState(0);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.id === selectedCaseId) ?? cases[0] ?? null,
    [cases, selectedCaseId]
  );

  const loadCases = useCallback(async () => {
    setIsCaseLoading(true);

    try {
      const nextCases = await apiRequest<CaseRecord[]>("/api/cases");
      setCases(nextCases);
      setSelectedCaseId((currentId) =>
        currentId && nextCases.some((caseRecord) => caseRecord.id === currentId)
          ? currentId
          : nextCases[0]?.id ?? null
      );
      return nextCases;
    } finally {
      setIsCaseLoading(false);
    }
  }, []);

  const loadCaseTypes = useCallback(async () => {
    try {
      const nextCaseTypes = await apiRequest<CaseType[]>("/api/case-types");
      setCaseTypes(nextCaseTypes.length ? nextCaseTypes : fallbackCaseTypes);
    } catch {
      setCaseTypes(fallbackCaseTypes);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const nextSettings = await apiRequest<UserSettings>("/api/settings");
      setSettings(nextSettings);
      return nextSettings;
    } catch {
      const fallbackSettings = createFallbackSettings();
      setSettings(fallbackSettings);
      return fallbackSettings;
    }
  }, []);

  const loadUnreadNotificationCount = useCallback(async () => {
    try {
      const notifications = await apiRequest<AppNotification[]>("/api/notifications");
      setUnreadNotificationCount(
        notifications.filter((notification) => !notification.readAt).length
      );
    } catch {
      setUnreadNotificationCount(0);
    }
  }, []);

  const loadUnreadInboxCount = useCallback(async () => {
    try {
      const conversations = await apiRequest<Array<{ readAt: string | null }>>(
        "/api/inbox/conversations"
      );
      setUnreadInboxCount(
        conversations.filter((conversation) => !conversation.readAt).length
      );
    } catch {
      setUnreadInboxCount(0);
    }
  }, []);

  const refreshNotifications = useCallback(() => {
    setNotificationRefreshKey((currentKey) => currentKey + 1);
    void loadUnreadNotificationCount();
  }, [loadUnreadNotificationCount]);

  const refreshInbox = useCallback(() => {
    setInboxRefreshKey((currentKey) => currentKey + 1);
    void loadUnreadInboxCount();
  }, [loadUnreadInboxCount]);

  const loadCaseDetail = useCallback(async (caseId: string) => {
    const caseDetail = await apiRequest<CaseRecord>(`/api/cases/${caseId}`);
    setCases((currentCases) => {
      const caseExists = currentCases.some((caseRecord) => caseRecord.id === caseDetail.id);

      if (!caseExists) {
        return [caseDetail, ...currentCases];
      }

      return currentCases.map((caseRecord) =>
        caseRecord.id === caseDetail.id ? caseDetail : caseRecord
      );
    });
    setSelectedCaseId(caseDetail.id);
    return caseDetail;
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const theme = settings?.theme ?? defaultUserSettingsValues.theme;
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme =
        theme === "SYSTEM" ? (colorScheme.matches ? "dark" : "light") : theme.toLowerCase();
      root.dataset.theme = resolvedTheme;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.classList.toggle("light", resolvedTheme === "light");
    };

    applyTheme();
    const accent = (settings?.accentColor ?? defaultUserSettingsValues.accentColor).toLowerCase();
    root.dataset.accent = accent;
    root.classList.toggle("accent-champagne", accent === "champagne");
    root.classList.toggle("accent-teal", accent === "teal");
    const reduceMotion = settings?.reduceMotion ?? defaultUserSettingsValues.reduceMotion;
    root.dataset.reduceMotion = String(reduceMotion);
    root.classList.toggle("reduce-motion", reduceMotion);

    if (theme === "SYSTEM") {
      colorScheme.addEventListener("change", applyTheme);
      return () => colorScheme.removeEventListener("change", applyTheme);
    }

    return undefined;
  }, [settings]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      const searchParams = new URL(window.location.href).searchParams;
      const resetToken = searchParams.get("resetToken");

      if (!portfolioMode && resetToken) {
        if (isMounted) {
          setPasswordResetToken(resetToken);
          setPublicAuthMode("login");
          setPublicView("auth");
          setIsBooting(false);
        }
        return;
      }

      const nextInvitationToken = searchParams.get("inviteToken");

      if (!portfolioMode && nextInvitationToken) {
        setInvitationToken(nextInvitationToken);
        setIsInvitationLoading(true);

        try {
          const invitationPreview = await apiRequest<CaseInvitationPreview>(
            `/api/public/collaboration/invitations/${encodeURIComponent(nextInvitationToken)}`
          );

          if (isMounted) {
            setInvitation(invitationPreview);
            setInvitationError(null);
          }
        } catch (error) {
          if (isMounted) {
            setInvitationError(
              error instanceof Error ? error.message : "Invitation could not be loaded."
            );
          }
        } finally {
          if (isMounted) {
            setIsInvitationLoading(false);
          }
        }
      }

      try {
        const currentUser = await apiRequest<AuthUser>("/api/auth/me");
        if (!isMounted) {
          return;
        }
        setUser(currentUser);
        const [nextCases] = await Promise.all([
          loadCases(),
          loadCaseTypes(),
          loadSettings(),
          loadUnreadInboxCount(),
          loadUnreadNotificationCount()
        ]);

        if (isMounted && nextCases[0]) {
          await loadCaseDetail(nextCases[0].id);
        }
      } catch (error) {
        if (isMounted && error instanceof ApiClientError && error.status !== 401) {
          setMessage(error.message);
        }
      } finally {
        if (isMounted) {
          setIsBooting(false);
        }
      }
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, [
    loadCaseDetail,
    loadCases,
    loadCaseTypes,
    loadSettings,
    loadUnreadInboxCount,
    loadUnreadNotificationCount,
    portfolioMode
  ]);

  async function authenticate(
    path: "/api/auth/demo" | "/api/auth/login" | "/api/auth/register",
    payload: Record<string, string>
  ) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await apiRequest<{ user: AuthUser }>(path, {
        body: JSON.stringify(payload),
        method: "POST"
      });
      setUser(response.user);
      setActiveView("home");
      refreshInbox();
      refreshNotifications();
      const [nextCases] = await Promise.all([loadCases(), loadCaseTypes(), loadSettings()]);

      if (nextCases[0]) {
        await loadCaseDetail(nextCases[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setMessage(null);
    await apiRequest("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCases([]);
    setSettings(null);
    setSelectedCaseId(null);
    setActiveView("home");
    setActiveCaseDestinationId("case-overview");
    setUnreadInboxCount(0);
    setUnreadNotificationCount(0);
    setPublicView("landing");
  }

  function clearPasswordResetToken() {
    setPasswordResetToken(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("resetToken");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function clearInvitationToken() {
    setInvitationToken(null);
    setInvitation(null);
    setInvitationError(null);
    setIsInvitationLoading(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("inviteToken");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function handleInvitationDecision(decision: "accept" | "decline") {
    if (!invitationToken) {
      return;
    }

    setIsInvitationSubmitting(true);
    setInvitationError(null);

    try {
      const response = await apiRequest<CaseInvitationDecisionResponse>(
        `/api/collaboration/invitations/${encodeURIComponent(invitationToken)}/${decision}`,
        { method: "POST" }
      );
      clearInvitationToken();
      setMessage(response.message);

      if (response.caseId) {
        await loadCases();
        await loadCaseDetail(response.caseId);
        setActiveCaseDestinationId("case-overview");
        setActiveView("case");
        refreshNotifications();
        scrollToPageTop();
      }
    } catch (error) {
      setInvitationError(
        error instanceof Error ? error.message : "Invitation response could not be saved."
      );
    } finally {
      setIsInvitationSubmitting(false);
    }
  }

  async function handleSwitchInvitationAccount() {
    setIsInvitationSubmitting(true);
    setInvitationError(null);

    try {
      await handleLogout();
      setPublicAuthMode("login");
      setPublicView("auth");
      scrollToPageTop();
    } catch (error) {
      setInvitationError(error instanceof Error ? error.message : "Account switch failed.");
    } finally {
      setIsInvitationSubmitting(false);
    }
  }

  async function handleCreateCase(payload: CreateCasePayload) {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const createdCase = await apiRequest<CaseRecord>("/api/cases", {
        body: JSON.stringify(payload),
        method: "POST"
      });
      await loadCases();
      await loadCaseDetail(createdCase.id);
      refreshNotifications();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Case creation failed.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateSettings(input: UpdateUserSettingsInput) {
    const updatedSettings = await apiRequest<UserSettings>("/api/settings", {
      body: JSON.stringify(input),
      method: "PATCH"
    });
    setSettings(updatedSettings);
    return updatedSettings;
  }

  async function handleOpenCase(
    caseId: string,
    destinationId: CaseDestinationId = "case-overview"
  ) {
    setSelectedCaseId(caseId);
    setMessage(null);

    try {
      await loadCaseDetail(caseId);
      setActiveCaseDestinationId(destinationId);
      setActiveView(destinationId === "evidence-intake" ? "upload" : "case");
      scrollToDestination(destinationId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Case detail could not be loaded.");
    }
  }

  async function handleSelectAssistantCase(caseId: string) {
    setSelectedCaseId(caseId);
    setMessage(null);

    try {
      await loadCaseDetail(caseId);
      scrollToPageTop();
    } catch (error) {
      const selectionError =
        error instanceof Error ? error : new Error("Case detail could not be loaded.");
      setMessage(selectionError.message);
      throw selectionError;
    }
  }

  async function handleArchiveCase(caseId: string) {
    setMessage(null);

    try {
      await apiRequest(`/api/cases/${caseId}`, { method: "DELETE" });
      const nextCases = cases.filter((caseRecord) => caseRecord.id !== caseId);
      setCases(nextCases);

      if (selectedCaseId === caseId) {
        const nextCaseId = nextCases[0]?.id ?? null;
        setSelectedCaseId(nextCaseId);

        if (nextCaseId) {
          try {
            await loadCaseDetail(nextCaseId);
          } catch (error) {
            setMessage(
              error instanceof Error
                ? `Case archived. ${error.message}`
                : "Case archived, but the next case could not be refreshed."
            );
          }
        }
      }

      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Archive failed.");
      return false;
    }
  }

  function handleNavigate(view: AppView) {
    setMessage(null);
    if (view === "account") {
      setAccountSection("profile");
    }
    if (view === "help") {
      setHelpInitialView("home");
      setHelpInitialRequestId(null);
    }
    setActiveView(view);
    scrollToPageTop();
  }

  function handleNavigateCaseDestination(destinationId: CaseDestinationId) {
    if (!selectedCase) {
      return;
    }

    void handleOpenCase(selectedCase.id, destinationId);
  }

  function handleOpenAccount(section: AccountSection) {
    setMessage(null);
    setAccountSection(section);
    setActiveView("account");
    scrollToPageTop();
  }

  function handleOpenSearchResult(result: GlobalSearchResult) {
    if (result.type === "SUPPORT") {
      setHelpInitialView("contact");
      setHelpInitialRequestId(result.id);
      setActiveView("help");
      scrollToPageTop();
      return;
    }

    if (!result.caseId) {
      return;
    }

    const destinations = {
      CASE: "case-overview",
      DOCUMENT: "evidence-intake",
      TIMELINE: "case-timeline",
      CHECKLIST: "evidence-checklist",
      STATEMENT: "statement-builder",
      PACKET: "packet-export"
    } as const;
    const destination = destinations[result.type];
    void handleOpenCase(result.caseId, destination);
  }

  function handleOpenSupport(notification: AppNotification) {
    setMessage(null);
    setHelpInitialView("contact");
    setHelpInitialRequestId(getSupportRequestIdFromNotification(notification.type));
    setActiveView("help");
    scrollToPageTop();
  }

  function handleOpenPacketShare() {
    if (!selectedCase) {
      return;
    }

    if (selectedCase.access?.canManage === false) {
      setMessage("Only the case owner can manage packet sharing.");
      return;
    }

    setMessage(null);
    setActiveView("share-packet");
    scrollToPageTop();
  }

  function handleOpenCollaboration() {
    if (!selectedCase || selectedCase.access?.canManage === false) {
      setMessage("Only the case owner can manage collaborators.");
      return;
    }

    handleNavigate("collaboration");
  }

  function handleClosePacketShare() {
    setMessage(null);
    setActiveView("case");
    scrollToDestination("packet-export");
  }

  function handleOpenPacketSupport() {
    setMessage(null);
    setHelpInitialView("contact");
    setHelpInitialRequestId(null);
    setActiveView("help");
    scrollToPageTop();
  }

  if (isBooting) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="grid gap-3 text-center">
          <Badge className="mx-auto">ProofPilot</Badge>
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    if (!portfolioMode && invitationToken && publicView !== "auth") {
      return (
        <CollaborationInvitationPanel
          error={invitationError}
          invitation={invitation}
          isLoading={isInvitationLoading}
          isSubmitting={isInvitationSubmitting}
          onAccept={() => handleInvitationDecision("accept")}
          onAuthenticate={(mode) => {
            setPublicAuthMode(mode);
            setPublicView("auth");
            scrollToPageTop();
          }}
          onDecline={() => handleInvitationDecision("decline")}
          onDismiss={() => {
            clearInvitationToken();
            setPublicView("landing");
            scrollToPageTop();
          }}
          onSwitchAccount={handleSwitchInvitationAccount}
          user={null}
        />
      );
    }

    if (publicView === "landing") {
      return (
        <PublicLanding
          error={message}
          isDemoStarting={isSubmitting}
          onExploreDemo={() => authenticate("/api/auth/demo", {})}
          onSelectAuth={(mode) => {
            setPublicAuthMode(mode);
            setPublicView("auth");
            scrollToPageTop();
          }}
          portfolioMode={portfolioMode}
        />
      );
    }

    return (
      <AuthPanel
        backLabel={invitationToken ? "Back to invitation" : "Back to overview"}
        error={message}
        initialEmail={invitation?.invitedEmail}
        initialMode={publicAuthMode}
        initialResetToken={passwordResetToken}
        isSubmitting={isSubmitting}
        key={`${publicAuthMode}:${passwordResetToken ?? ""}:${invitationToken ?? ""}`}
        onBack={() => {
          setMessage(null);
          clearPasswordResetToken();
          setPublicView("landing");
          scrollToPageTop();
        }}
        onClearError={() => setMessage(null)}
        onClearResetToken={clearPasswordResetToken}
        onDemoLogin={() => authenticate("/api/auth/demo", {})}
        onLogin={(input) => authenticate("/api/auth/login", input)}
        onRegister={(input) => authenticate("/api/auth/register", input)}
      />
    );
  }

  if (!portfolioMode && invitationToken) {
    return (
      <CollaborationInvitationPanel
        error={invitationError}
        invitation={invitation}
        isLoading={isInvitationLoading}
        isSubmitting={isInvitationSubmitting}
        onAccept={() => handleInvitationDecision("accept")}
        onAuthenticate={(mode) => {
          setPublicAuthMode(mode);
          setPublicView("auth");
        }}
        onDecline={() => handleInvitationDecision("decline")}
        onDismiss={clearInvitationToken}
        onSwitchAccount={handleSwitchInvitationAccount}
        user={user}
      />
    );
  }

  return (
    <AppShell
      activeCaseDestinationId={activeCaseDestinationId}
      activeView={activeView}
      hasCase={Boolean(selectedCase)}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
      onNavigateCaseDestination={handleNavigateCaseDestination}
      unreadInboxCount={unreadInboxCount}
      unreadNotificationCount={unreadNotificationCount}
      user={user}
    >
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
          onCreateCase={() => handleNavigate("create")}
          onOpenCase={handleOpenCase}
          onViewCases={() => handleNavigate("cases")}
          primaryCase={selectedCase}
        />
      ) : null}

      {activeView === "cases" ? (
        <CaseDashboard
          cases={cases}
          confirmBeforeDelete={
            settings?.confirmBeforeDelete ?? defaultUserSettingsValues.confirmBeforeDelete
          }
          isLoading={isCaseLoading}
          itemsPerPage={settings?.itemsPerPage ?? defaultUserSettingsValues.itemsPerPage}
          onArchiveCase={handleArchiveCase}
          onCreateCase={() => handleNavigate("create")}
          onSelectCase={handleOpenCase}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "create" ? (
        <CreateCaseForm
          caseTypes={caseTypes}
          isSubmitting={isSubmitting}
          onCancel={() => handleNavigate("cases")}
          onComplete={() => {
            setActiveView("upload");
            scrollToDestination("evidence-intake");
          }}
          onCreateCase={handleCreateCase}
        />
      ) : null}

      {activeView === "case" ? (
        <CaseWorkspace
          confirmBeforeDelete={
            settings?.confirmBeforeDelete ?? defaultUserSettingsValues.confirmBeforeDelete
          }
          onBackToCases={() => handleNavigate("cases")}
          onCaseChanged={loadCaseDetail}
          onNotificationsChanged={refreshNotifications}
          onOpenCollaboration={handleOpenCollaboration}
          onOpenPacketShare={handleOpenPacketShare}
          onSectionChange={setActiveCaseDestinationId}
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
          onBack={() => handleNavigate("case")}
        />
      ) : null}

      {activeView === "share-packet" &&
      selectedCase &&
      selectedCase.access?.canManage !== false ? (
        <PacketSharePanel
          caseRecord={selectedCase}
          externalSharingDisabled={user.isPortfolioDemo}
          key={selectedCase.id}
          onBack={handleClosePacketShare}
          onDone={handleClosePacketShare}
          onOpenSupport={handleOpenPacketSupport}
          ownerName={user.name ?? user.email}
        />
      ) : null}

      {activeView === "upload" ? (
        <EvidenceUploadView
          confirmBeforeDelete={
            settings?.confirmBeforeDelete ?? defaultUserSettingsValues.confirmBeforeDelete
          }
          onCaseChanged={loadCaseDetail}
          onCreateCase={() => handleNavigate("create")}
          onViewCases={() => handleNavigate("cases")}
          portfolioDemo={user.isPortfolioDemo}
          selectedCase={selectedCase}
        />
      ) : null}

      {activeView === "assistant" ? (
        <AssistantPanel
          cases={cases}
          onCreateCase={() => handleNavigate("create")}
          onOpenCase={handleOpenCase}
          onSelectCase={handleSelectAssistantCase}
          selectedCase={selectedCase}
          user={user}
        />
      ) : null}

      {activeView === "inbox" ? (
        <InboxPanel
          cases={cases}
          onNotificationsChanged={refreshNotifications}
          onOpenCase={(caseId) => {
            void handleOpenCase(caseId, "case-overview");
          }}
          onUnreadCountChange={setUnreadInboxCount}
          ownerName={user.name ?? user.email}
          refreshKey={inboxRefreshKey}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "notifications" ? (
        <NotificationCenter
          onInboxChanged={refreshInbox}
          onOpenCase={handleOpenCase}
          onOpenSupport={handleOpenSupport}
          onUnreadCountChange={setUnreadNotificationCount}
          refreshKey={notificationRefreshKey}
        />
      ) : null}

      {activeView === "more" ? (
        <MoreMenu
          onCreateCase={() => handleNavigate("create")}
          onOpenAccount={handleOpenAccount}
          onOpenAssistant={() => handleNavigate("assistant")}
          onOpenBilling={() => handleNavigate("billing")}
          onOpenCalendar={() => handleNavigate("calendar")}
          onOpenCase={handleOpenCase}
          onOpenConnections={() => handleNavigate("connections")}
          onOpenHelp={() => handleNavigate("help")}
          onOpenNotifications={() => handleNavigate("notifications")}
          onOpenReports={() => handleNavigate("reports")}
          onOpenSearch={() => handleNavigate("search")}
          onOpenSecurity={() => handleNavigate("security")}
          onOpenSettings={() => handleNavigate("settings")}
          onOpenTasks={() => handleNavigate("tasks")}
          onViewCases={() => handleNavigate("cases")}
          selectedCase={selectedCase}
          user={user}
        />
      ) : null}

      {activeView === "calendar" ? (
        <CalendarDeadlinesPanel
          cases={cases}
          onOpenCase={handleOpenCase}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "tasks" ? (
        <TasksPanel
          cases={cases}
          onOpenCase={(caseId) => {
            void handleOpenCase(caseId, "case-overview");
          }}
          ownerName={user.name ?? user.email}
          selectedCase={selectedCase}
        />
      ) : null}

      {activeView === "reports" ? (
        <ReportsPanel
          cases={cases}
          onOpenCase={(caseId) => {
            void handleOpenCase(caseId);
          }}
        />
      ) : null}

      {activeView === "help" ? (
        <HelpCenterPanel
          cases={cases}
          initialRequestId={helpInitialRequestId}
          initialView={helpInitialView}
          onSupportRequestCreated={() => {
            refreshInbox();
            refreshNotifications();
          }}
          selectedCaseId={selectedCase?.id ?? null}
        />
      ) : null}

      {activeView === "search" ? (
        <SearchPanel cases={cases} onOpenResult={handleOpenSearchResult} />
      ) : null}

      {activeView === "settings" ? (
        <SettingsPanel onUpdate={handleUpdateSettings} settings={settings} />
      ) : null}

      {activeView === "security" ? (
        <SecurityPrivacyPanel
          onBack={() => handleNavigate("more")}
          onOpenHelp={() => handleNavigate("help")}
          onOpenReports={() => handleNavigate("reports")}
          onUpdateSettings={handleUpdateSettings}
          portfolioDemo={user.isPortfolioDemo}
          settings={settings}
        />
      ) : null}

      {activeView === "connections" ? <ConnectedAccountsPanel /> : null}

      {activeView === "billing" ? (
        <BillingPanel
          onBack={() => handleNavigate("more")}
          onOpenHelp={() => handleNavigate("help")}
        />
      ) : null}

      {activeView === "account" ? (
        <AccountPanel
          cases={cases}
          onSectionChange={setAccountSection}
          onUserChanged={setUser}
          section={accountSection}
          user={user}
        />
      ) : null}
    </AppShell>
  );
}

function scrollToPageTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ behavior: getScrollBehavior(), top: 0 });
  });
}

function scrollToDestination(destinationId: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const destination = document.getElementById(destinationId);

      if (destination) {
        destination.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
      } else {
        window.scrollTo({ behavior: getScrollBehavior(), top: 0 });
      }
    });
  });
}

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reduceMotion === "true"
    ? "auto"
    : "smooth";
}

function createFallbackSettings(): UserSettings {
  const timestamp = new Date().toISOString();

  return {
    ...defaultUserSettingsValues,
    lastSyncedAt: timestamp,
    updatedAt: timestamp,
    storage: {
      documentBytes: 0,
      documentCount: 0,
      exportBytes: 0,
      exportCount: 0,
      usedBytes: 0
    }
  };
}
