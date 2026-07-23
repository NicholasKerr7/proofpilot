import Image from "next/image";
import { formatCaseReference } from "@/components/app/cases/case-utils";
import type { CasePacketExport, CaseRecord } from "@/lib/client/types";

interface PacketCoverPageProps {
  packetExport: CasePacketExport;
  selectedCase: CaseRecord;
}

export function PacketCoverPage({ packetExport, selectedCase }: PacketCoverPageProps) {
  const ownerName =
    selectedCase.owner?.name?.trim() || selectedCase.owner?.email || "Case owner";

  return (
    <article
      aria-label={`Cover page for ${selectedCase.title}`}
      className="packet-cover-page relative z-10 aspect-[210/297] overflow-hidden rounded-md border"
    >
      <div className="packet-cover-watermark" aria-hidden="true">
        <Image
          alt=""
          className="h-full w-full object-contain"
          height={220}
          src="/brand/proofpilot-brand-icon-transparent.webp"
          width={220}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col p-6 sm:p-9">
        <div className="-ml-2 flex items-center">
          <Image
            alt=""
            className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
            height={44}
            priority
            src="/brand/proofpilot-brand-icon-transparent.webp"
            width={44}
          />
          <p
            aria-label="ProofPilot"
            className="-ml-0.5 text-base font-semibold italic text-[#f4f5f6] sm:text-lg"
          >
            Proof<span className="text-[#ff6b16]">Pilot</span>
          </p>
        </div>

        <div className="mt-3 h-px w-full bg-[#d95718] sm:mt-4" aria-hidden="true" />

        <div className="mt-5 sm:mt-7">
          <h5 className="max-w-[16rem] break-words text-base font-semibold leading-6 text-[#f3f4f5] sm:text-xl sm:leading-7">
            {selectedCase.title}
          </h5>
          <p className="mt-2 text-xs font-medium text-[#ff6b16] sm:text-sm">
            Case ID: {formatCaseReference(selectedCase)}
          </p>
        </div>

        <dl className="mt-5 grid gap-4 text-[11px] leading-4 sm:mt-6 sm:gap-5 sm:text-xs sm:leading-5">
          <div>
            <dt className="text-[#8d969f]">Prepared for:</dt>
            <dd className="mt-0.5 break-words text-[#d9dde0]">
              {selectedCase.platform} Account Review Team
            </dd>
          </div>
          <div>
            <dt className="text-[#8d969f]">Prepared by:</dt>
            <dd className="mt-0.5 break-words text-[#d9dde0]">{ownerName}</dd>
          </div>
        </dl>

        <time
          className="mt-auto text-[11px] text-[#8d969f] sm:text-xs"
          dateTime={packetExport.createdAt}
        >
          {formatCoverDate(packetExport.createdAt)}
        </time>
      </div>
    </article>
  );
}

function formatCoverDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}
