"use client";

import type { ProofMapClaim, ProofMapResponse } from "@proofpilot/types";
import { useEffect, useState } from "react";
import { RefreshCcw, ScanSearch } from "lucide-react";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { ProofMapClaimList } from "@/components/app/proof-map/proof-map-claim-list";
import { ProofMapSourceInspector } from "@/components/app/proof-map/proof-map-source-inspector";
import { ProofMapSummary } from "@/components/app/proof-map/proof-map-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

interface ProofMapPanelProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onOpenDestination: (destinationId: CaseDestinationId) => void;
  readOnly: boolean;
  selectedCase: CaseRecord;
}

export function ProofMapPanel({
  onCaseChanged,
  onOpenDestination,
  readOnly,
  selectedCase
}: ProofMapPanelProps) {
  const [proofMap, setProofMap] = useState<ProofMapResponse | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void apiRequest<ProofMapResponse>(
      `/api/cases/${selectedCase.id}/proof-map`,
      { signal: controller.signal }
    )
      .then((nextProofMap) => {
        if (!controller.signal.aborted) {
          setProofMap(nextProofMap);
          setSelectedClaimId((current) =>
            resolveSelectedClaimId(nextProofMap, current)
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setMessage(
            error instanceof Error ? error.message : "Proof Map could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedCase.id]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setMessage(null);

    try {
      if (!readOnly) {
        await apiRequest(`/api/cases/${selectedCase.id}/checklist/analyze`, {
          method: "POST"
        });
        await onCaseChanged(selectedCase.id);
      }

      const nextProofMap = await apiRequest<ProofMapResponse>(
        `/api/cases/${selectedCase.id}/proof-map`
      );
      setProofMap(nextProofMap);
      setSelectedClaimId((current) =>
        resolveSelectedClaimId(nextProofMap, current)
      );
      setMessage("Proof Map refreshed from the latest case records.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Proof Map could not be refreshed."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const selectedClaim =
    proofMap?.claims.find((claim) => claim.id === selectedClaimId) ??
    proofMap?.claims[0] ??
    null;

  if (isLoading) {
    return (
      <div
        aria-label="Loading Proof Map"
        className="grid min-h-96 place-items-center rounded-md border border-border bg-card"
        role="status"
      >
        <div className="grid justify-items-center gap-3 text-center">
          <ScanSearch
            className="h-7 w-7 text-primary motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Connecting claims to case records...
          </p>
        </div>
      </div>
    );
  }

  if (!proofMap || !selectedClaim) {
    return (
      <Card>
        <CardContent className="grid min-h-72 place-items-center p-6 text-center">
          <div>
            <ScanSearch
              className="mx-auto h-7 w-7 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-lg font-semibold">
              No appeal claims available
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This case needs an evidence checklist before its proof coverage can
              be evaluated.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5" id="proof-map">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Every required appeal argument is connected to the evidence, dated
          events, and statement language that supports it.
        </p>
        <Button
          disabled={isRefreshing}
          onClick={() => {
            void handleRefresh();
          }}
          type="button"
          variant="outline"
        >
          <RefreshCcw
            className={`h-4 w-4 ${isRefreshing ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isRefreshing ? "Refreshing..." : "Refresh links"}
        </Button>
      </div>

      {message ? (
        <p
          className="rounded-md border border-border bg-secondary/35 px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <ProofMapSummary summary={proofMap.summary} />

      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.18fr)]">
          <ProofMapClaimList
            claims={proofMap.claims}
            onSelect={setSelectedClaimId}
            selectedClaimId={selectedClaim.id}
          />
          <ProofMapSourceInspector
            claim={selectedClaim}
            onOpenDestination={onOpenDestination}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function selectInitialClaim(claims: ProofMapClaim[]) {
  return (
    claims.find((claim) => claim.status === "MISSING") ??
    claims.find((claim) => claim.status === "NEEDS_REVIEW") ??
    claims.find((claim) => claim.status === "WEAK") ??
    claims[0]
  );
}

function resolveSelectedClaimId(
  proofMap: ProofMapResponse,
  currentClaimId: string
) {
  return proofMap.claims.some((claim) => claim.id === currentClaimId)
    ? currentClaimId
    : (selectInitialClaim(proofMap.claims)?.id ?? "");
}
