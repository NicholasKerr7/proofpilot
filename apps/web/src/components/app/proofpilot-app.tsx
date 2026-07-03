"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiStatus } from "@/components/system/api-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/app/auth-panel";
import { AppShell } from "@/components/app/app-shell";
import { CaseDashboard } from "@/components/app/case-dashboard";
import { CaseWorkspace } from "@/components/app/case-workspace";
import { CreateCaseForm } from "@/components/app/create-case-form";
import { NotificationCenter } from "@/components/app/notification-center";
import { apiRequest, ApiClientError } from "@/lib/client/api";
import type { AuthUser, CaseRecord, CaseType, CreateCasePayload } from "@/lib/client/types";

const fallbackCaseTypes: CaseType[] = [
  {
    id: "account-ban-appeal",
    slug: "account-ban-appeal",
    name: "Account Ban / Appeal Builder",
    description: "Build an organized appeal packet for account bans, holds, closures, and platform restrictions."
  }
];

export function ProofPilotApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>(fallbackCaseTypes);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCaseLoading, setIsCaseLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);

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

  const refreshNotifications = useCallback(() => {
    setNotificationRefreshKey((currentKey) => currentKey + 1);
  }, []);

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
    let isMounted = true;

    async function boot() {
      try {
        const currentUser = await apiRequest<AuthUser>("/api/auth/me");
        if (!isMounted) {
          return;
        }
        setUser(currentUser);
        const [nextCases] = await Promise.all([loadCases(), loadCaseTypes()]);

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
  }, [loadCaseDetail, loadCases, loadCaseTypes]);

  async function authenticate(
    path: "/api/auth/login" | "/api/auth/register",
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
      refreshNotifications();
      const [nextCases] = await Promise.all([loadCases(), loadCaseTypes()]);

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
    setSelectedCaseId(null);
    refreshNotifications();
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Case creation failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSelectCase(caseId: string) {
    setSelectedCaseId(caseId);
    setMessage(null);

    try {
      await loadCaseDetail(caseId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Case detail could not be loaded.");
    }
  }

  async function handleArchiveCase(caseId: string) {
    setMessage(null);

    try {
      await apiRequest(`/api/cases/${caseId}`, { method: "DELETE" });
      const nextCases = cases.filter((caseRecord) => caseRecord.id !== caseId);
      setCases(nextCases);

      if (selectedCaseId === caseId) {
        setSelectedCaseId(nextCases[0]?.id ?? null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Archive failed.");
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
    return (
      <AuthPanel
        error={message}
        isSubmitting={isSubmitting}
        onLogin={(input) => authenticate("/api/auth/login", input)}
        onRegister={(input) => authenticate("/api/auth/register", input)}
      />
    );
  }

  return (
    <AppShell user={user} onLogout={handleLogout}>
      <div className="grid gap-4 rounded-lg border border-border bg-card/70 p-4 backdrop-blur sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge>Account Ban / Appeal Builder</Badge>
            <div className="hidden lg:block">
              <ApiStatus />
            </div>
          </div>
          <h1 className="max-w-3xl text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
            Build and manage private appeal cases.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Create a case, collect evidence, review gaps, draft the statement, and prepare a packet.
          </p>
        </div>
        <Button onClick={() => setSelectedCaseId(cases[0]?.id ?? null)} variant="outline">
          Current cases: {cases.length}
        </Button>
      </div>

      {message ? (
        <p className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {message}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="grid gap-5">
          <NotificationCenter refreshKey={notificationRefreshKey} />

          <CaseDashboard
            cases={cases}
            isLoading={isCaseLoading}
            onArchiveCase={handleArchiveCase}
            onSelectCase={handleSelectCase}
            selectedCaseId={selectedCase?.id ?? null}
          />
          <CaseWorkspace
            onCaseChanged={loadCaseDetail}
            onNotificationsChanged={refreshNotifications}
            selectedCase={selectedCase}
          />
        </div>
        <CreateCaseForm
          caseTypes={caseTypes}
          isSubmitting={isSubmitting}
          onCreateCase={handleCreateCase}
        />
      </div>
    </AppShell>
  );
}
