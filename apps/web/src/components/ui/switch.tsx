import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "onClick" | "role" | "type"
  > {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, className, disabled, onCheckedChange, ...props }, ref) => (
    <button
      {...props}
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-11 w-12 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      ref={ref}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 rounded-full border transition-colors",
          checked ? "border-primary/70 bg-primary" : "border-border bg-muted"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
);
Switch.displayName = "Switch";
