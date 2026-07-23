"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  type GlobalSearchResult,
  type UpdateUserSettingsInput,
  type UserSettings
} from "@proofpilot/types";
import type { AccountSection } from "@/components/app/account/account-panel";
import { AppShell, type AppView } from "@/components/app/app-shell";
import { AuthPanel } from "@/components/app/auth-panel";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { getSupportRequestIdFromNotification } from "@/components/app/notifications/notification-utils";
import { CollaborationInvitationPanel } from "@/components/app/proofpilot-workspace-panels";
import { scrollToPageTop } from "@/components/app/proofpilot-scroll";
import { ProofPilotWorkspaceView } from "@/components/app/proofpilot-workspace-view";
import { PublicLanding } from "@/components/app/public/public-landing";
import { useProofPilotData } from "@/components/app/use-proofpilot-data";
import { useProofPilotSession } from "@/components/app/use-proofpilot-session";
import { useProofPilotTheme } from "@/components/app/use-proofpilot-theme";
import {
  getCaseWorkspacePath,
  getWorkspaceViewPath,
  isWorkspacePath,
  resolveWorkspaceRoute
} from "@/components/app/workspace-routing";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/client/api";
import type {
  AppNotification,
  CaseRecord,
  CreateCasePayload
} from "@/lib/client/types";

interface ProofPilotAppProps {
  portfolioMode?: boolean;
}

/** Coordinates URL routing, session state, and the active ProofPilot workspace. */
export function ProofPilotApp({ portfolioMode = false }: ProofPilotAppProps) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceRoute = resolveWorkspaceRoute(pathname);
  const activeView = workspaceRoute.view;
  const activeCaseDestinationId = workspaceRoute.destinationId;
  const accountSection = workspaceRoute.accountSection;
  const [helpInitialView, setHelpInitialView] = useState<"home" | "contact">("home");
  const [helpInitialRequestId, setHelpInitialRequestId] = useState<string | null>(null);
  const [isCaseSubmitting, setIsCaseSubmitting] = useState(false);
  const data = useProofPilotData(workspaceRoute.caseId);
  const {
    cases,
    caseTypes,
    inboxRefreshKey,
    isCaseLoading,
    loadCaseDetail,
    loadCases,
    loadCaseTypes,
    loadSettings,
    loadUnreadInboxCount,
    loadUnreadNotificationCount,
    notificationRefreshKey,
    refreshInbox,
    refreshNotifications,
    selectedCase,
    selectedCaseId,
    setCases,
    setSelectedCaseId,
    setSettings,
    setUnreadInboxCount,
    setUnreadNotificationCount,
    settings,
    unreadInboxCount,
    unreadNotificationCount
  } = data;

  const resetWorkspace = useCallback(() => {
    setCases([]);
    setSettings(null);
    setSelectedCaseId(null);
    setUnreadInboxCount(0);
    setUnreadNotificationCount(0);
  }, [
    setCases,
    setSelectedCaseId,
    setSettings,
    setUnreadInboxCount,
    setUnreadNotificationCount
  ]);

  const session = useProofPilotSession({
    initialPathname: pathname,
    loadCaseDetail,
    loadCases,
    loadCaseTypes,
    loadSettings,
    loadUnreadInboxCount,
    loadUnreadNotificationCount,
    portfolioMode,
    refreshInbox,
    refreshNotifications,
    resetWorkspace
  });
  const {
    authenticate,
    clearInvitationToken,
    clearPasswordResetToken,
    decideInvitation,
    invitation,
    invitationError,
    invitationToken,
    isBooting,
    isInvitationLoading,
    isInvitationSubmitting,
    isSubmitting: isAuthSubmitting,
    logout,
    message,
    passwordResetToken,
    publicAuthMode,
    publicView,
    setMessage,
    setPublicAuthMode,
    setPublicView,
    setUser,
    switchInvitationAccount,
    user
  } = session;

  useProofPilotTheme(settings);

  useEffect(() => {
    if (!user || isBooting || !isWorkspacePath(pathname)) {
      return;
    }

    const route = resolveWorkspaceRoute(pathname);
    const pendingCaseId = route.caseId !== selectedCaseId ? route.caseId : null;
    const timeoutId = pendingCaseId
      ? window.setTimeout(() => {
          void loadCaseDetail(pendingCaseId).catch((error: unknown) => {
            setMessage(
              error instanceof Error ? error.message : "Case detail could not be loaded."
            );
            router.replace("/app/cases");
          });
        }, 0)
      : null;

    scrollToPageTop();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isBooting, loadCaseDetail, pathname, router, selectedCaseId, setMessage, user]);

  /** Creates a case and refreshes the selected workspace record. */
  async function handleCreateCase(payload: CreateCasePayload) {
    setIsCaseSubmitting(true);
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
      setIsCaseSubmitting(false);
    }
  }

  /** Persists settings and immediately updates document-level preferences. */
  async function handleUpdateSettings(input: UpdateUserSettingsInput) {
    const updatedSettings = await apiRequest<UserSettings>("/api/settings", {
      body: JSON.stringify(input),
      method: "PATCH"
    });
    setSettings(updatedSettings);
    return updatedSettings;
  }

  /** Loads and opens one case at the requested workspace destination. */
  async function handleOpenCase(
    caseId: string,
    destinationId: CaseDestinationId = "case-overview"
  ) {
    setSelectedCaseId(caseId);
    setMessage(null);

    try {
      await loadCaseDetail(caseId);
      router.push(getCaseWorkspacePath(caseId, destinationId));
      scrollToPageTop();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Case detail could not be loaded.");
    }
  }

  /** Changes assistant context while preserving the current route. */
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

  /** Archives a case and selects the next available record when necessary. */
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

  /** Navigates to a top-level workspace view while retaining relevant case context. */
  function handleNavigate(view: AppView) {
    setMessage(null);
    const nextAccountSection = view === "account" ? "profile" : accountSection;
    if (view === "help") {
      setHelpInitialView("home");
      setHelpInitialRequestId(null);
    }
    router.push(
      getWorkspaceViewPath(view, {
        accountSection: nextAccountSection,
        caseId: selectedCaseId,
        destinationId: activeCaseDestinationId
      })
    );
    scrollToPageTop();
  }

  /** Opens a case subview for the currently selected case. */
  function handleNavigateCaseDestination(destinationId: CaseDestinationId) {
    if (selectedCase) {
      void handleOpenCase(selectedCase.id, destinationId);
    }
  }

  /** Opens a specific account settings section. */
  function handleOpenAccount(section: AccountSection) {
    setMessage(null);
    router.push(getWorkspaceViewPath("account", { accountSection: section }));
    scrollToPageTop();
  }

  /** Resolves a global search result to its owning workspace destination. */
  function handleOpenSearchResult(result: GlobalSearchResult) {
    if (result.type === "SUPPORT") {
      setHelpInitialView("contact");
      setHelpInitialRequestId(result.id);
      router.push(getWorkspaceViewPath("help"));
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
    void handleOpenCase(result.caseId, destinations[result.type]);
  }

  /** Opens the support request represented by a notification. */
  function handleOpenSupport(notification: AppNotification) {
    setMessage(null);
    setHelpInitialView("contact");
    setHelpInitialRequestId(getSupportRequestIdFromNotification(notification.type));
    router.push(getWorkspaceViewPath("help"));
    scrollToPageTop();
  }

  /** Opens owner-only packet sharing for the selected case. */
  function handleOpenPacketShare() {
    if (!selectedCase) {
      return;
    }

    if (selectedCase.access?.canManage === false) {
      setMessage("Only the case owner can manage packet sharing.");
      return;
    }

    setMessage(null);
    router.push(getWorkspaceViewPath("share-packet", { caseId: selectedCase.id }));
    scrollToPageTop();
  }

  /** Opens owner-only collaborator management for the selected case. */
  function handleOpenCollaboration() {
    if (!selectedCase || selectedCase.access?.canManage === false) {
      setMessage("Only the case owner can manage collaborators.");
      return;
    }

    setMessage(null);
    router.push(getWorkspaceViewPath("collaboration", { caseId: selectedCase.id }));
    scrollToPageTop();
  }

  /** Returns packet sharing to the selected case export view. */
  function handleClosePacketShare() {
    setMessage(null);
    if (selectedCase) {
      router.push(getCaseWorkspacePath(selectedCase.id, "packet-export"));
    }
    scrollToPageTop();
  }

  /** Opens support from the packet-sharing workflow. */
  function handleOpenPacketSupport() {
    setMessage(null);
    setHelpInitialView("contact");
    setHelpInitialRequestId(null);
    router.push(getWorkspaceViewPath("help"));
    scrollToPageTop();
  }

  async function handleResetDemo() {
    setMessage(null);

    try {
      await apiRequest("/api/auth/demo/reset", { method: "POST" });
      window.location.assign("/app");
    } catch (error) {
      const resetMessage =
        error instanceof Error ? error.message : "The demo could not be reset.";
      setMessage(resetMessage);
    }
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
          onAccept={() => decideInvitation("accept")}
          onAuthenticate={(mode) => {
            setPublicAuthMode(mode);
            setPublicView("auth");
            scrollToPageTop();
          }}
          onDecline={() => decideInvitation("decline")}
          onDismiss={() => {
            clearInvitationToken();
            setPublicView("landing");
            scrollToPageTop();
          }}
          onSwitchAccount={switchInvitationAccount}
          user={null}
        />
      );
    }

    if (publicView === "landing") {
      return (
        <PublicLanding
          error={message}
          isDemoStarting={isAuthSubmitting}
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
        isSubmitting={isAuthSubmitting}
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
        onAccept={() => decideInvitation("accept")}
        onAuthenticate={(mode) => {
          setPublicAuthMode(mode);
          setPublicView("auth");
        }}
        onDecline={() => decideInvitation("decline")}
        onDismiss={clearInvitationToken}
        onSwitchAccount={switchInvitationAccount}
        user={user}
      />
    );
  }

  return (
    <AppShell
      activeCaseDestinationId={activeCaseDestinationId}
      activeView={activeView}
      hasCase={Boolean(selectedCase)}
      onLogout={logout}
      onNavigate={handleNavigate}
      onNavigateCaseDestination={handleNavigateCaseDestination}
      onResetDemo={handleResetDemo}
      unreadInboxCount={unreadInboxCount}
      unreadNotificationCount={unreadNotificationCount}
      user={user}
    >
      <ProofPilotWorkspaceView
        accountSection={accountSection}
        activeCaseDestinationId={activeCaseDestinationId}
        activeView={activeView}
        cases={cases}
        caseTypes={caseTypes}
        helpInitialRequestId={helpInitialRequestId}
        helpInitialView={helpInitialView}
        inboxRefreshKey={inboxRefreshKey}
        isCaseLoading={isCaseLoading}
        isSubmitting={isCaseSubmitting}
        message={message}
        notificationRefreshKey={notificationRefreshKey}
        onArchiveCase={handleArchiveCase}
        onCaseChanged={loadCaseDetail}
        onClosePacketShare={handleClosePacketShare}
        onCreateCase={handleCreateCase}
        onInboxChanged={refreshInbox}
        onNavigate={handleNavigate}
        onNavigateCaseDestination={handleNavigateCaseDestination}
        onNotificationsChanged={refreshNotifications}
        onOpenAccount={handleOpenAccount}
        onOpenCase={handleOpenCase}
        onOpenCollaboration={handleOpenCollaboration}
        onOpenPacketShare={handleOpenPacketShare}
        onOpenPacketSupport={handleOpenPacketSupport}
        onOpenSearchResult={handleOpenSearchResult}
        onOpenSupport={handleOpenSupport}
        onSelectAssistantCase={handleSelectAssistantCase}
        onUnreadInboxCountChange={setUnreadInboxCount}
        onUnreadNotificationCountChange={setUnreadNotificationCount}
        onUpdateSettings={handleUpdateSettings}
        onUserChanged={setUser}
        selectedCase={selectedCase}
        settings={settings}
        user={user}
      />
    </AppShell>
  );
}
