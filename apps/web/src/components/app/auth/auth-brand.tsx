import Image from "next/image";
import { cn } from "@/lib/utils";

interface AuthBrandProps {
  className?: string;
}

export function AuthBrand({ className }: AuthBrandProps) {
  return (
    <div aria-label="ProofPilot" className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Image
        alt=""
        className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
        height={56}
        priority
        src="/brand/proofpilot-brand-icon-transparent.webp"
        width={56}
      />
      <span className="truncate text-2xl font-semibold text-foreground sm:text-3xl">
        Proof<span className="text-primary">Pilot</span>
      </span>
    </div>
  );
}
