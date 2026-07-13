import type { BillingPortalSection } from "@proofpilot/types";
import {
  ChevronRight,
  CreditCard,
  Headphones,
  LayoutGrid,
  LoaderCircle,
  ReceiptText,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BillingManagementProps {
  busySection: BillingPortalSection | null;
  error: string | null;
  onOpenHelp: () => void;
  onOpenPortal: (section: BillingPortalSection) => void;
  providerConfigured: boolean;
}

export function BillingManagement({
  busySection,
  error,
  onOpenHelp,
  onOpenPortal,
  providerConfigured
}: BillingManagementProps) {
  return (
    <section
      aria-labelledby="billing-management-heading"
      className="rounded-md border border-border bg-card p-4 md:p-5"
    >
      <h2 className="text-sm font-semibold uppercase text-primary" id="billing-management-heading">
        Manage
      </h2>
      <div className="mt-3 divide-y divide-border border-y border-border">
        <ManagementAction
          busy={busySection === "PLAN"}
          detail="Change plan or billing cycle."
          icon={LayoutGrid}
          label="Manage plan"
          onClick={() => onOpenPortal("PLAN")}
        />
        <ManagementAction
          busy={busySection === "PAYMENT_METHOD"}
          detail="Update or change your card."
          icon={CreditCard}
          label="Update payment method"
          onClick={() => onOpenPortal("PAYMENT_METHOD")}
        />
        <ManagementAction
          detail="Download your recent PDF receipts below."
          icon={ReceiptText}
          label="Invoice history"
          onClick={() => {
            document.getElementById("recent-invoices-heading")?.scrollIntoView({
              behavior: document.documentElement.dataset.reduceMotion === "true" ? "auto" : "smooth"
            });
          }}
        />
      </div>

      {error ? (
        <p
          className="mt-3 flex items-start gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-100"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : !providerConfigured ? (
        <p className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
          Live plan and payment changes are not configured for this demo workspace.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-t border-border pt-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Headphones className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">Need help?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Contact support about billing records.</p>
        </div>
        <Button className="col-span-2 sm:col-span-1" onClick={onOpenHelp} type="button" variant="outline">
          Contact support
        </Button>
      </div>
    </section>
  );
}

interface ManagementActionProps {
  busy?: boolean;
  detail: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

function ManagementAction({
  busy = false,
  detail,
  icon: Icon,
  label,
  onClick
}: ManagementActionProps) {
  return (
    <button
      aria-busy={busy}
      className="grid min-h-17 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        {busy ? (
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Icon className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
