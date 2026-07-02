import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-primary/35 bg-primary/15 text-amber-100",
        secondary: "border-border bg-secondary text-muted-foreground",
        success: "border-teal-400/30 bg-teal-400/10 text-teal-100",
        warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
        danger: "border-red-400/30 bg-red-400/10 text-red-100"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
