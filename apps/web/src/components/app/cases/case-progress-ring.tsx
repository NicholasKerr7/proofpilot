import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CaseProgressRingProps {
  className?: string;
  label?: string;
  size?: "compact" | "default";
  value: number;
}

export function CaseProgressRing({
  className,
  label = "Progress",
  size = "default",
  value
}: CaseProgressRingProps) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)));
  const isComplete = safeValue === 100;

  return (
    <div
      aria-label={`${label}: ${safeValue}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cn(
        "proof-progress-orb relative isolate grid shrink-0 place-items-center",
        isComplete ? "proof-progress-orb-complete" : null,
        size === "compact" ? "h-16 w-16" : "h-24 w-24 sm:h-32 sm:w-32 md:h-36 md:w-36",
        className
      )}
      role="progressbar"
    >
      <svg
        className="absolute inset-0 h-full w-full -rotate-90 overflow-visible"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <circle
          className="proof-progress-orb-stroke opacity-10"
          cx="50"
          cy="50"
          fill="none"
          r="45"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          className="text-secondary"
          cx="50"
          cy="50"
          fill="none"
          r="40"
          stroke="currentColor"
          strokeWidth="9"
        />
        <circle
          className="proof-progress-orb-stroke opacity-20"
          cx="50"
          cy="50"
          fill="none"
          pathLength="100"
          r="40"
          stroke="currentColor"
          strokeDasharray={`${safeValue} ${100 - safeValue}`}
          strokeLinecap="round"
          strokeWidth="14"
        />
        <circle
          className="proof-progress-orb-stroke"
          cx="50"
          cy="50"
          fill="none"
          pathLength="100"
          r="40"
          stroke="currentColor"
          strokeDasharray={`${safeValue} ${100 - safeValue}`}
          strokeLinecap="round"
          strokeWidth="7"
        />
        <circle
          className="proof-progress-orb-stroke opacity-45"
          cx="50"
          cy="50"
          fill="none"
          pathLength="100"
          r="36"
          stroke="currentColor"
          strokeDasharray={`${safeValue} ${100 - safeValue}`}
          strokeLinecap="round"
          strokeWidth="1"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {isComplete ? (
          <Check
            className={cn(
              "text-lime-300 drop-shadow-[0_0_6px_rgba(132,255,55,0.28)]",
              size === "compact" ? "mb-0.5 h-3.5 w-3.5" : "mb-1 h-4 w-4"
            )}
            aria-hidden="true"
          />
        ) : null}
        <span
          className={cn(
            "font-semibold tracking-normal text-foreground drop-shadow-[0_0_5px_rgba(255,255,255,0.16)]",
            size === "compact" ? "text-base" : "text-2xl sm:text-3xl"
          )}
        >
          {safeValue}%
        </span>
        {size === "default" ? (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
            {label}
          </span>
        ) : null}
      </span>
    </div>
  );
}
