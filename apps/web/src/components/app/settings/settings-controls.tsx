import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

/** Frames one settings domain and its rows. */
export function SettingsSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <h2 className="border-b border-border px-3 py-3 text-xs font-semibold uppercase text-primary sm:px-4 md:px-5">
        {title}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** Aligns a settings label, description, icon, and control. */
export function SettingsRow({
  control,
  description,
  icon: Icon,
  title
}: {
  control: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4 md:px-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <span className="col-span-2 flex min-w-0 justify-end sm:col-span-1">{control}</span>
    </div>
  );
}

/** Renders a compact labeled switch inside an expanded settings disclosure. */
export function CompactSwitch({
  checked,
  disabled,
  label,
  onCheckedChange
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-2 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch
        aria-label={`Toggle ${label.toLowerCase()}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

/** Renders one storage aggregate in the data disclosure. */
export function StorageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
