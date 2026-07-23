"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type CaseInvitationDecisionResponse,
  type CaseInvitationPreview
} from "@proofpilot/types";
import type { AuthMode } from "@/components/app/auth-panel";
import { scrollToPageTop } from "@/components/app/proofpilot-scroll";
import {
  getCaseWorkspacePath,
  isWorkspacePath,
  resolveWorkspaceRoute
} from "@/components/app/workspace-routing";
import { apiRequest, ApiClientError } from "@/lib/client/api";
import type { AuthUser, CaseRecord } from "@/lib/client/types";

interface UseProofPilotSessionInput {
  initialPathname: string;
  loadCaseDetail: (caseId: string) => Promise<CaseRecord>;
  loadCases: () => Promise<CaseRecord[]>;
  loadCaseTypes: () => Promise<void>;
  loadSettings: () => Promise<unknown>;
  loadUnreadInboxCount: () => Promise<void>;
  loadUnreadNotificationCount: () => Promise<void>;
  portfolioMode: boolean;
  refreshInbox: () => void;
  refreshNotifications: () => void;
  resetWorkspace: () => void;
}

/** Owns public authentication, invitation handling, and initial session hydration. */
export function useProofPilotSession({
  initialPathname,
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
}: UseProofPilotSessionInput) {
  const router = useRouter();
  const initialPathnameRef = useRef(initialPathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [publicView, setPublicView] = useState<"landing" | "auth">("landing");
  const [publicAuthMode, setPublicAuthMode] = useState<AuthMode>("login");
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<CaseInvitationPreview | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [isInvitationLoading, setIsInvitationLoading] = useState(false);
  const [isInvitationSubmitting, setIsInvitationSubmitting] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

        const route = resolveWorkspaceRoute(initialPathnameRef.current);
        const targetCaseId = route.caseId ?? nextCases[0]?.id;

        if (isMounted && targetCaseId) {
          await loadCaseDetail(targetCaseId);
        }

        if (isMounted && !isWorkspacePath(initialPathnameRef.current)) {
          router.replace("/app");
        }
      } catch (error) {
        if (isMounted && error instanceof ApiClientError && error.status !== 401) {
          setMessage(error.message);
        }

        if (
          isMounted &&
          error instanceof ApiClientError &&
          error.status === 401 &&
          isWorkspacePath(initialPathnameRef.current)
        ) {
          router.replace("/");
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
    portfolioMode,
    router
  ]);

  /** Authenticates through the selected endpoint and hydrates the private workspace. */
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
      router.push("/app");
      refreshInbox();
      refreshNotifications();
      const [nextCases] = await Promise.all([
        loadCases(),
        loadCaseTypes(),
        loadSettings()
      ]);

      if (nextCases[0]) {
        await loadCaseDetail(nextCases[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Ends the server session and clears all user-scoped client state. */
  async function logout() {
    setMessage(null);
    await apiRequest("/api/auth/logout", { method: "POST" });
    setUser(null);
    resetWorkspace();
    setPublicView("landing");
    router.replace("/");
  }

  /** Removes a consumed password reset token from state and browser history. */
  function clearPasswordResetToken() {
    setPasswordResetToken(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("resetToken");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  /** Clears invitation state and removes its token from browser history. */
  function clearInvitationToken() {
    setInvitationToken(null);
    setInvitation(null);
    setInvitationError(null);
    setIsInvitationLoading(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("inviteToken");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  /** Accepts or declines an invitation and opens the shared case when appropriate. */
  async function decideInvitation(decision: "accept" | "decline") {
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
        router.push(getCaseWorkspacePath(response.caseId));
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

  /** Signs out before returning an invitation recipient to login. */
  async function switchInvitationAccount() {
    setIsInvitationSubmitting(true);
    setInvitationError(null);

    try {
      await logout();
      setPublicAuthMode("login");
      setPublicView("auth");
      scrollToPageTop();
    } catch (error) {
      setInvitationError(error instanceof Error ? error.message : "Account switch failed.");
    } finally {
      setIsInvitationSubmitting(false);
    }
  }

  return {
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
    isSubmitting,
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
  };
}
