"use client";

import { useEffect, useState } from "react";
import {
  PacketExportContent,
  type PacketReadinessState
} from "@/components/app/packet-export-content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { CasePacket, CaseRecord } from "@/lib/client/types";

interface PacketExportPanelProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onNotificationsChanged: () => void;
  onOpenPacketShare: () => void;
  readiness: number;
  selectedCase: CaseRecord;
}

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

export function PacketExportPanel({
  onCaseChanged,
  onNotificationsChanged,
  onOpenPacketShare,
  readiness,
  selectedCase
}: PacketExportPanelProps) {
  const [packets, setPackets] = useState<CasePacket[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const hasGeneratingPacket = packets.some((packet) => packet.status === "GENERATING");

  useEffect(() => {
    let isMounted = true;

    async function loadPackets() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextPackets = await fetchCasePackets(selectedCase.id);

        if (isMounted) {
          setPackets(nextPackets);
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Packet exports could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPackets();

    return () => {
      isMounted = false;
    };
  }, [selectedCase.id]);

  useEffect(() => {
    if (!hasGeneratingPacket) {
      return;
    }

    let isMounted = true;
    const intervalId = window.setInterval(() => {
      async function refreshQueuedPacket() {
        try {
          const nextPackets = await fetchCasePackets(selectedCase.id);

          if (!isMounted) {
            return;
          }

          const isStillGenerating = nextPackets.some(
            (packet) => packet.status === "GENERATING"
          );

          if (isStillGenerating) {
            setPackets(nextPackets);
            return;
          }

          window.clearInterval(intervalId);
          await onCaseChanged(selectedCase.id);

          if (!isMounted) {
            return;
          }

          setPackets(nextPackets);
          onNotificationsChanged();

          const latestPacket = nextPackets[0] ?? null;
          if (latestPacket?.status === "READY") {
            setNotice({ tone: "success", text: "Packet is ready to download." });
          } else if (latestPacket?.status === "FAILED") {
            setNotice({
              tone: "error",
              text: "Packet generation failed. Review export history and retry."
            });
          }
        } catch (error) {
          if (isMounted) {
            setNotice({
              tone: "error",
              text: error instanceof Error ? error.message : "Packet status could not be refreshed."
            });
          }
        }
      }

      void refreshQueuedPacket();
    }, 2500);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [hasGeneratingPacket, onCaseChanged, onNotificationsChanged, selectedCase.id]);

  async function handleGeneratePacket() {
    if (hasGeneratingPacket) {
      return;
    }

    setIsGenerating(true);
    setNotice({ tone: "info", text: "Queueing packet generation..." });

    try {
      const queuedPacket = await apiRequest<CasePacket>(
        `/api/cases/${selectedCase.id}/packet/generate`,
        {
          method: "POST"
        }
      );

      setPackets((currentPackets) => [
        queuedPacket,
        ...currentPackets.filter((packet) => packet.id !== queuedPacket.id)
      ]);
      setNotice({
        tone: "info",
        text: "Packet generation queued. This panel will refresh when it is ready."
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Packet generation failed."
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const latestPacket = packets[0] ?? null;
  const latestReadyPacket = packets.find(
    (packet) => packet.status === "READY" && packet.exports.length > 0
  );
  const latestExport = latestReadyPacket?.exports[0] ?? null;
  const readinessState = getReadinessState(readiness, latestPacket);
  const generateLabel = getGenerateLabel(latestPacket, isGenerating, hasGeneratingPacket);

  return (
    <Card id="packet-export" className="scroll-mt-28 lg:scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Packet export</CardTitle>
            <CardDescription>Review packet readiness, generate the PDF, and manage exports.</CardDescription>
          </div>
          {latestPacket ? (
            <Badge variant={getPacketStatusVariant(latestPacket.status)}>
              {formatStatus(latestPacket.status)}
            </Badge>
          ) : (
            <Badge variant={readinessState.variant}>{readinessState.badge}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice ? (
          <p
            aria-live="polite"
            className={getNoticeClassName(notice.tone)}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.text}
          </p>
        ) : null}

        <PacketExportContent
          generateLabel={generateLabel}
          isGenerateDisabled={isGenerating || hasGeneratingPacket}
          isLoading={isLoading}
          latestExport={latestExport}
          latestReadyPacket={latestReadyPacket ?? null}
          onGenerate={handleGeneratePacket}
          onOpenPacketShare={onOpenPacketShare}
          packets={packets}
          readiness={readiness}
          readinessState={readinessState}
          selectedCase={selectedCase}
        />
      </CardContent>
    </Card>
  );
}

function fetchCasePackets(caseId: string) {
  return apiRequest<CasePacket[]>(`/api/cases/${caseId}/packets`);
}

function getReadinessState(
  readiness: number,
  latestPacket: CasePacket | null
): PacketReadinessState {
  if (latestPacket?.status === "READY") {
    return {
      badge: "Packet ready",
      description: "The latest PDF is available below. Regenerate it after case changes.",
      title: "Latest packet is ready to download",
      variant: "success"
    };
  }

  if (latestPacket?.status === "GENERATING") {
    return {
      badge: "Generating",
      description: "ProofPilot is assembling the PDF and will refresh this panel automatically.",
      title: "Packet generation is in progress",
      variant: "warning"
    };
  }

  if (latestPacket?.status === "FAILED") {
    return {
      badge: "Retry needed",
      description: "The latest generation attempt failed. Review the case and retry the export.",
      title: "Packet generation needs attention",
      variant: "danger"
    };
  }

  if (readiness === 100) {
    return {
      badge: "Ready",
      description: "All readiness checks pass. Generate the PDF for a final review.",
      title: "Packet is ready to generate",
      variant: "success"
    };
  }

  if (readiness >= 70) {
    return {
      badge: "Final review",
      description: "The packet can be generated now, but remaining gaps should be reviewed first.",
      title: "Review the remaining packet gaps",
      variant: "warning"
    };
  }

  return {
    badge: "In progress",
    description: "Add evidence, timeline events, checklist matches, and a statement before export.",
    title: "Continue building the case packet",
    variant: "secondary"
  };
}

function getGenerateLabel(
  latestPacket: CasePacket | null,
  isGenerating: boolean,
  hasGeneratingPacket: boolean
) {
  if (hasGeneratingPacket) {
    return "Packet queued";
  }

  if (isGenerating) {
    return "Queueing...";
  }

  if (latestPacket?.status === "READY") {
    return "Regenerate packet";
  }

  if (latestPacket?.status === "FAILED") {
    return "Retry generation";
  }

  return "Generate packet";
}

function getNoticeClassName(tone: Notice["tone"]) {
  if (tone === "success") {
    return "rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-100";
  }

  if (tone === "error") {
    return "rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100";
  }

  return "rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100";
}

const packetStatusVariants = {
  FAILED: "danger",
  GENERATING: "warning",
  READY: "success"
} as const;

function getPacketStatusVariant(status: string) {
  return packetStatusVariants[status as keyof typeof packetStatusVariants] ?? "secondary";
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
