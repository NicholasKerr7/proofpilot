"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, FileArchive, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/client/api";
import type { CasePacket, CaseRecord } from "@/lib/client/types";

interface PacketExportPanelProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onNotificationsChanged: () => void;
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

          setPackets(nextPackets);

          if (nextPackets.some((packet) => packet.status === "GENERATING")) {
            return;
          }

          window.clearInterval(intervalId);
          await onCaseChanged(selectedCase.id);

          if (!isMounted) {
            return;
          }

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
  const sections = getPacketSections(selectedCase);

  return (
    <Card id="packet-export" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Packet export</CardTitle>
            <CardDescription>Generate and download the PDF case packet.</CardDescription>
          </div>
          {latestPacket ? (
            <Badge variant={getPacketStatusVariant(latestPacket.status)}>
              {formatStatus(latestPacket.status)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice ? <p className={getNoticeClassName(notice.tone)}>{notice.text}</p> : null}

        <Progress value={readiness} label="Overall readiness" />
        <Separator />

        {sections.map((section) => (
          <div key={section.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <CheckCircle2
                className={
                  section.ready ? "h-4 w-4 shrink-0 text-primary" : "h-4 w-4 shrink-0 text-muted-foreground"
                }
              />
              <span className="truncate">{section.label}</span>
            </span>
            <Badge variant={section.ready ? "success" : "secondary"}>{section.status}</Badge>
          </div>
        ))}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => {
              void handleGeneratePacket();
            }}
            disabled={isGenerating || hasGeneratingPacket}
          >
            <FileArchive className="h-4 w-4" />
            {hasGeneratingPacket ? "Packet queued" : isGenerating ? "Queueing..." : "Generate packet"}
          </Button>
          {latestExport ? (
            <Button asChild variant="secondary">
              <a href={latestExport.downloadUrl} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            <span>Export history</span>
            {isLoading ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCcw className="h-3.5 w-3.5" />
                Loading
              </span>
            ) : null}
          </div>
          {packets.length ? (
            packets.slice(0, 3).map((packet) => {
              return (
                <div
                  key={packet.id}
                  className="rounded-md border border-border bg-secondary/45 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{formatStatus(packet.status)}</span>
                    <span className="text-muted-foreground">{formatDateTime(packet.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getPacketHistoryLabel(packet)}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-xs text-muted-foreground">
              No packet exports yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function fetchCasePackets(caseId: string) {
  return apiRequest<CasePacket[]>(`/api/cases/${caseId}/packets`);
}

function getPacketSections(caseRecord: CaseRecord) {
  const checklistItems = caseRecord.checklist ?? [];
  const readyChecklistItems = checklistItems.filter((item) => isChecklistReady(item.status)).length;
  const hasStatement = Boolean(caseRecord.summary || caseRecord._count?.statements);

  return [
    {
      label: "Case summary",
      ready: Boolean(caseRecord.summary),
      status: caseRecord.summary ? "Ready" : "Draft"
    },
    {
      label: "Timeline",
      ready: Boolean(caseRecord.events?.length ?? caseRecord._count?.events),
      status: caseRecord.events?.length ? `${caseRecord.events.length} events` : "Draft"
    },
    {
      label: "Evidence index",
      ready: Boolean(caseRecord._count?.documents),
      status: `${caseRecord._count?.documents ?? 0} files`
    },
    {
      label: "Evidence checklist",
      ready: checklistItems.length > 0 && readyChecklistItems === checklistItems.length,
      status: checklistItems.length ? `${readyChecklistItems}/${checklistItems.length} ready` : "Draft"
    },
    {
      label: "User statement",
      ready: hasStatement,
      status: hasStatement ? "Ready" : "Draft"
    }
  ];
}

function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function getPacketHistoryLabel(packet: CasePacket) {
  const packetExport = packet.exports[0];

  if (typeof packetExport?.byteSize === "number") {
    return formatBytes(packetExport.byteSize);
  }

  if (packet.status === "GENERATING") {
    return "Generation in progress";
  }

  if (packet.status === "FAILED") {
    return "No PDF generated";
  }

  return "PDF export";
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
