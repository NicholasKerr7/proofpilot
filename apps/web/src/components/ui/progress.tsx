import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  label,
  ariaLabel
}: {
  value: number;
  className?: string;
  label?: string;
  ariaLabel?: string;
}) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{safeValue}%</span>
        </div>
      ) : null}
      <progress
        className="proof-progress"
        value={safeValue}
        max={100}
        aria-label={ariaLabel ?? label ?? "Progress"}
      />
    </div>
  );
}
