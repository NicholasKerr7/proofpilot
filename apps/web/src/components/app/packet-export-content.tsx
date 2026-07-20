"use client";

import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Download,
  FileArchive,
  FileCheck2,
  FileText,
  Flag,
  FolderOpen,
  ListChecks,
  Paperclip,
  PenLine,
  RefreshCcw,
  Share2,
  type LucideIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PacketDocumentPreview } from "@/components/app/packet-document-preview";
import { Progress } from "@/components/ui/progress";
import type { CasePacket, CasePacketExport, CaseRecord } from "@/lib/client/types";

type PacketSection = {
  description: string;
  icon: LucideIcon;
  label: string;
  ready: boolean;
  status: string;
};

export type PacketReadinessState = {
  badge: string;
  description: string;
  title: string;
  variant: "danger" | "secondary" | "success" | "warning";
};

interface PacketExportContentProps {
  generateLabel: string;
  isGenerateDisabled: boolean;
  isLoading: boolean;
  latestExport: CasePacketExport | null;
  latestReadyPacket: CasePacket | null;
  onGenerate: () => Promise<void>;
  onOpenPacketShare: () => void;
  packets: CasePacket[];
  readiness: number;
  readinessState: PacketReadinessState;
  selectedCase: CaseRecord;
}

export function PacketExportContent({
  generateLabel,
  isGenerateDisabled,
  isLoading,
  latestExport,
  latestReadyPacket,
  onGenerate,
  onOpenPacketShare,
  packets,
  readiness,
  readinessState,
  selectedCase
}: PacketExportContentProps) {
  const sections = getPacketSections(selectedCase);

  return (
    <>
      <PacketReadinessSummary
        readiness={readiness}
        readinessState={readinessState}
        sections={sections}
      />

      {latestExport ? <PacketDocumentPreview packetExport={latestExport} /> : null}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
        <PacketSectionManifest sections={sections} />

        <aside className="grid content-start gap-4 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <PacketExportActions
            generateLabel={generateLabel}
            isGenerateDisabled={isGenerateDisabled}
            latestExport={latestExport}
            latestReadyPacket={latestReadyPacket}
            onGenerate={onGenerate}
            onOpenPacketShare={onOpenPacketShare}
          />
          <PacketExportHistory isLoading={isLoading} packets={packets} />
        </aside>
      </div>
    </>
  );
}

interface PacketReadinessSummaryProps {
  readiness: number;
  readinessState: PacketReadinessState;
  sections: PacketSection[];
}

function PacketReadinessSummary({
  readiness,
  readinessState,
  sections
}: PacketReadinessSummaryProps) {
  const readySectionCount = sections.filter((section) => section.ready).length;

  return (
    <section
      aria-labelledby="packet-readiness-heading"
      className="grid gap-4 border-y border-border py-4 md:grid-cols-[7.5rem_minmax(0,1fr)] md:items-center"
    >
      <div className="flex items-baseline gap-2 md:grid md:gap-1">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Readiness</span>
        <strong className="text-4xl font-semibold text-foreground">{readiness}%</strong>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 id="packet-readiness-heading" className="text-sm font-semibold text-foreground">
              {readinessState.title}
            </h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {readinessState.description}
            </p>
          </div>
          <Badge variant={readySectionCount === sections.length ? "success" : "secondary"}>
            {readySectionCount}/{sections.length} sections
          </Badge>
        </div>
        <Progress className="mt-3" value={readiness} label="Overall readiness" />
      </div>
    </section>
  );
}

function PacketSectionManifest({ sections }: { sections: PacketSection[] }) {
  return (
    <section aria-labelledby="packet-sections-heading" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4
          id="packet-sections-heading"
          className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
        >
          Included sections
        </h4>
        <span className="text-xs text-muted-foreground">{sections.length} section manifest</span>
      </div>
      <div className="mt-2 divide-y divide-border border-y border-border">
        {sections.map((section) => {
          const Icon = section.icon;
          const StatusIcon = section.ready ? CheckCircle2 : CircleDashed;

          return (
            <div
              key={section.label}
              className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{section.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {section.description}
                </span>
              </span>
              <Badge className="gap-1.5" variant={section.ready ? "success" : "secondary"}>
                <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {section.status}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface PacketExportActionsProps {
  generateLabel: string;
  isGenerateDisabled: boolean;
  latestExport: CasePacketExport | null;
  latestReadyPacket: CasePacket | null;
  onGenerate: () => Promise<void>;
  onOpenPacketShare: () => void;
}

function PacketExportActions({
  generateLabel,
  isGenerateDisabled,
  latestExport,
  latestReadyPacket,
  onGenerate,
  onOpenPacketShare
}: PacketExportActionsProps) {
  return (
    <section aria-labelledby="packet-actions-heading">
      <h4
        id="packet-actions-heading"
        className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
      >
        Export actions
      </h4>
      <div className="mt-2 grid gap-2">
        <Button
          type="button"
          onClick={() => {
            void onGenerate();
          }}
          disabled={isGenerateDisabled}
        >
          <FileArchive className="h-4 w-4" aria-hidden="true" />
          {generateLabel}
        </Button>
        {latestExport ? (
          <>
            <Button onClick={onOpenPacketShare} type="button" variant="secondary">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share latest packet
            </Button>
            <Button asChild variant="secondary">
              <a href={latestExport.downloadUrl} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" aria-hidden="true" />
                Download latest PDF
              </a>
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" disabled>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download latest PDF
          </Button>
        )}
      </div>
      {latestReadyPacket && latestExport ? (
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Latest PDF</dt>
            <dd className="font-medium text-foreground">
              {typeof latestExport.byteSize === "number"
                ? formatBytes(latestExport.byteSize)
                : "Ready"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Generated</dt>
            <dd className="text-right font-medium text-foreground">
              {formatDateTime(latestReadyPacket.createdAt)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Pages</dt>
            <dd className="font-medium text-foreground">
              {latestExport.pageCount ?? "Not recorded"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Supporting files</dt>
            <dd className="font-medium text-foreground">
              {latestExport.includedDocumentCount}/{latestExport.indexedDocumentCount}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

function PacketExportHistory({
  isLoading,
  packets
}: {
  isLoading: boolean;
  packets: CasePacket[];
}) {
  return (
    <section aria-labelledby="packet-history-heading" className="border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4
          id="packet-history-heading"
          className="text-xs font-semibold uppercase tracking-normal text-muted-foreground"
        >
          Export history
        </h4>
        {isLoading ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Loading
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid gap-2">
        {packets.length ? (
          packets.slice(0, 3).map((packet) => {
            const packetExport = packet.exports[0];

            return (
              <div
                key={packet.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-secondary/45 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {formatStatus(packet.status)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(packet.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getPacketHistoryLabel(packet)}
                  </p>
                </div>
                {packetExport ? (
                  <Button asChild className="shrink-0" size="icon" variant="ghost">
                    <a
                      aria-label={`Download packet generated ${formatDateTime(packet.createdAt)}`}
                      href={packetExport.downloadUrl}
                      rel="noreferrer"
                      target="_blank"
                      title="Download this PDF"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-xs leading-5 text-muted-foreground">
            No packet exports yet. Generate the first PDF when the case is ready for review.
          </div>
        )}
      </div>
    </section>
  );
}

function getPacketSections(caseRecord: CaseRecord): PacketSection[] {
  const checklistItems = caseRecord.checklist ?? [];
  const readyChecklistItems = checklistItems.filter((item) => isChecklistReady(item.status)).length;
  const documentCount = caseRecord._count?.documents ?? 0;
  const eventCount = caseRecord.events?.length ?? caseRecord._count?.events ?? 0;
  const hasStatement = Boolean(caseRecord._count?.statements);

  return [
    {
      description: "Case identity, platform, owner, and generation details.",
      icon: FileCheck2,
      label: "Cover page",
      ready: true,
      status: "Included"
    },
    {
      description: "Situation, deadline, and the core context for the appeal.",
      icon: FileText,
      label: "Case summary",
      ready: Boolean(caseRecord.summary),
      status: caseRecord.summary ? "Ready" : "Draft"
    },
    {
      description: "The latest saved appeal statement for platform review.",
      icon: PenLine,
      label: "User statement",
      ready: hasStatement,
      status: hasStatement ? "Ready" : "Draft"
    },
    {
      description: "An evidence-backed sequence of notices, responses, and actions.",
      icon: Clock3,
      label: "Timeline of events",
      ready: eventCount > 0,
      status: eventCount ? `${eventCount} events` : "Draft"
    },
    {
      description: "Requirement matches, supporting files, and unresolved gaps.",
      icon: ListChecks,
      label: "Evidence checklist",
      ready: checklistItems.length > 0 && readyChecklistItems === checklistItems.length,
      status: checklistItems.length ? `${readyChecklistItems}/${checklistItems.length}` : "Draft"
    },
    {
      description: "An indexed inventory of uploaded evidence and file details.",
      icon: FolderOpen,
      label: "Evidence index",
      ready: documentCount > 0,
      status: `${documentCount} files`
    },
    {
      description: "Original evidence pages and extracted text assembled with the report.",
      icon: Paperclip,
      label: "Supporting documents",
      ready: documentCount > 0,
      status: documentCount ? `${documentCount} files` : "Draft"
    },
    {
      description: "Submission, recordkeeping, and follow-up guidance.",
      icon: Flag,
      label: "Next steps",
      ready: true,
      status: "Included"
    }
  ];
}

function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
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

  if (packetExport) {
    return [
      typeof packetExport.pageCount === "number"
        ? `${packetExport.pageCount} ${packetExport.pageCount === 1 ? "page" : "pages"}`
        : null,
      typeof packetExport.byteSize === "number" ? formatBytes(packetExport.byteSize) : null
    ]
      .filter((value): value is string => Boolean(value))
      .join(" | ") || "PDF export";
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
