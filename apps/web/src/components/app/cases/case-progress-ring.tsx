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

  return (
    <div
      aria-label={`${label}: ${safeValue}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cn(
        "relative grid shrink-0 place-items-center",
        size === "compact" ? "h-16 w-16" : "h-24 w-24 sm:h-32 sm:w-32 md:h-36 md:w-36",
        className
      )}
      role="progressbar"
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle
          className="text-secondary"
          cx="50"
          cy="50"
          fill="none"
          r="42"
          stroke="currentColor"
          strokeWidth="7"
        />
        <circle
          className="text-primary"
          cx="50"
          cy="50"
          fill="none"
          pathLength="100"
          r="42"
          stroke="currentColor"
          strokeDasharray={`${safeValue} ${100 - safeValue}`}
          strokeLinecap="round"
          strokeWidth="7"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={cn(
            "font-semibold text-foreground",
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
