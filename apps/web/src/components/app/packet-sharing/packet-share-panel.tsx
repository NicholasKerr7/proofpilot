"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileWarning } from "lucide-react";
import type {
  CreatePacketShareInput,
  PacketShareCreatedResponse,
  PacketSharePreparationResponse,
  PacketShareRevokedResponse
} from "@proofpilot/types";
import { PacketShareCompose } from "@/components/app/packet-sharing/packet-share-compose";
import { PacketShareSuccess } from "@/components/app/packet-sharing/packet-share-success";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

interface PacketSharePanelProps {
  caseRecord: CaseRecord;
  externalSharingDisabled: boolean;
  onBack: () => void;
  onDone: () => void;
  onOpenSupport: () => void;
  ownerName: string;
}

export function PacketSharePanel({
  caseRecord,
  externalSharingDisabled,
  onBack,
  onDone,
  onOpenSupport,
  ownerName
}: PacketSharePanelProps) {
  const [preparation, setPreparation] = useState<PacketSharePreparationResponse | null>(null);
  const [createdShare, setCreatedShare] = useState<PacketShareCreatedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPreparation() {
      try {
        const nextPreparation = await apiRequest<PacketSharePreparationResponse>(
          `/api/cases/${caseRecord.id}/packet-shares/prepare`
        );

        if (isMounted) {
          setPreparation(nextPreparation);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Packet sharing could not be prepared."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPreparation();

    return () => {
      isMounted = false;
    };
  }, [caseRecord.id]);

  function createShare(input: CreatePacketShareInput) {
    return apiRequest<PacketShareCreatedResponse>(
      `/api/cases/${caseRecord.id}/packet-shares`,
      {
        body: JSON.stringify(input),
        method: "POST"
      }
    );
  }

  async function revokeShare(shareId: string) {
    await apiRequest<PacketShareRevokedResponse>(
      `/api/cases/${caseRecord.id}/packet-shares/${shareId}`,
      { method: "DELETE" }
    );
    setPreparation((current) =>
      current
        ? {
            ...current,
            activeShares: current.activeShares.filter((share) => share.id !== shareId)
          }
        : current
    );
  }

  if (isLoading) {
    return (
      <div className="grid min-h-[28rem] place-items-center rounded-md border border-border bg-card px-4 text-center text-sm text-muted-foreground">
        Preparing the latest packet share...
      </div>
    );
  }

  if (error || !preparation) {
    return (
      <PacketShareUnavailable
        detail={error ?? "Packet sharing could not be prepared."}
        onBack={onBack}
        title="Share packet unavailable"
      />
    );
  }

  if (externalSharingDisabled) {
    return (
      <PacketShareUnavailable
        detail="Outbound email and public recipient links are disabled in this temporary portfolio workspace."
        onBack={onBack}
        title="Sharing is disabled in the demo"
      />
    );
  }

  if (!preparation.packet) {
    return (
      <PacketShareUnavailable
        detail="Generate a ready PDF export before creating a recipient link."
        onBack={onBack}
        title="A ready packet is required"
      />
    );
  }

  if (createdShare) {
    return (
      <PacketShareSuccess
        caseRecord={caseRecord}
        onBack={onBack}
        onDone={onDone}
        onOpenSupport={onOpenSupport}
        onRevoke={revokeShare}
        ownerName={ownerName}
        share={createdShare}
        suggestedRecipients={preparation.suggestedRecipients}
      />
    );
  }

  return (
    <PacketShareCompose
      caseRecord={caseRecord}
      onBack={onBack}
      onCreate={createShare}
      onCreated={setCreatedShare}
      onRevoke={revokeShare}
      ownerName={ownerName}
      preparation={{ ...preparation, packet: preparation.packet }}
    />
  );
}

interface PacketShareUnavailableProps {
  detail: string;
  onBack: () => void;
  title: string;
}

function PacketShareUnavailable({ detail, onBack, title }: PacketShareUnavailableProps) {
  return (
    <div className="grid min-h-[28rem] place-items-center rounded-md border border-border bg-card px-5 py-10 text-center">
      <div className="max-w-md">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <FileWarning className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
        <Button className="mt-5" onClick={onBack} type="button" variant="outline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to packet export
        </Button>
      </div>
    </div>
  );
}
