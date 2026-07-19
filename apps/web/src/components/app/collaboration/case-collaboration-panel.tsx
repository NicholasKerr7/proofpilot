"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import type {
  CaseCollaborationResponse,
  CaseCollaboratorRole,
  InviteCaseCollaboratorInput,
  UpdateCaseCollaborationSettingsInput
} from "@proofpilot/types";
import { CollaborationActivity } from "@/components/app/collaboration/collaboration-activity";
import { CollaborationCaseHero } from "@/components/app/collaboration/collaboration-case-hero";
import { CollaborationControls } from "@/components/app/collaboration/collaboration-controls";
import { CollaboratorRoster } from "@/components/app/collaboration/collaborator-roster";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

interface CaseCollaborationPanelProps {
  caseRecord: CaseRecord;
  onBack: () => void;
}

export function CaseCollaborationPanel({ caseRecord, onBack }: CaseCollaborationPanelProps) {
  const [data, setData] = useState<CaseCollaborationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void apiRequest<CaseCollaborationResponse>(
      `/api/cases/${caseRecord.id}/collaboration`,
      { signal: controller.signal }
    )
      .then((response) => {
        if (!controller.signal.aborted) {
          setData(response);
        }
      })
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Case collaboration could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [caseRecord.id, reloadKey]);

  async function mutate(
    action: string,
    path: string,
    init: RequestInit,
    successMessage: string
  ) {
    setPendingAction(action);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<CaseCollaborationResponse>(path, init);
      setData(response);
      setMessage(successMessage);
      return true;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "The collaboration change could not be saved."
      );
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleInvite(input: InviteCaseCollaboratorInput) {
    return mutate(
      "invite",
      `/api/cases/${caseRecord.id}/collaboration/invitations`,
      {
        body: JSON.stringify(input),
        method: "POST"
      },
      "Invitation created."
    );
  }

  async function handleRoleChange(collaboratorId: string, role: CaseCollaboratorRole) {
    await mutate(
      `role:${collaboratorId}`,
      `/api/cases/${caseRecord.id}/collaboration/collaborators/${collaboratorId}`,
      {
        body: JSON.stringify({ role }),
        method: "PATCH"
      },
      "Collaborator role updated."
    );
  }

  async function handleRemove(collaboratorId: string) {
    return mutate(
      `remove:${collaboratorId}`,
      `/api/cases/${caseRecord.id}/collaboration/collaborators/${collaboratorId}`,
      { method: "DELETE" },
      "Collaborator removed."
    );
  }

  async function handleSettingsUpdate(input: UpdateCaseCollaborationSettingsInput) {
    await mutate(
      "settings",
      `/api/cases/${caseRecord.id}/collaboration/settings`,
      {
        body: JSON.stringify(input),
        method: "PATCH"
      },
      "Sharing controls updated."
    );
  }

  return (
    <section aria-labelledby="case-collaboration-heading" className="grid gap-4 md:gap-5">
      <CollaborationCaseHero caseRecord={caseRecord} onBack={onBack} />

      {message ? (
        <p
          className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-3 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>{error}</span>
          {!data ? (
            <Button
              onClick={() => {
                setIsLoading(true);
                setError(null);
                setReloadKey((currentKey) => currentKey + 1);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCcw aria-hidden="true" className="h-4 w-4" />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLoading && !data ? (
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-6 text-sm text-muted-foreground">
            Loading case collaboration...
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <CollaboratorRoster
              collaborators={data.collaborators}
              onInvite={handleInvite}
              onRemove={handleRemove}
              onRoleChange={handleRoleChange}
              owner={data.owner}
              pendingAction={pendingAction}
              seatLimit={data.seatLimit}
              seatsUsed={data.seatsUsed}
            />
            <CollaborationControls
              onUpdate={handleSettingsUpdate}
              onViewActivity={() => scrollToActivity()}
              pendingAction={pendingAction}
              settings={data.settings}
            />
          </div>
          <CollaborationActivity activity={data.activity} />
        </>
      ) : null}
    </section>
  );
}

function scrollToActivity() {
  const reduceMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reduceMotion === "true";

  document.getElementById("collaboration-activity")?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start"
  });
}
