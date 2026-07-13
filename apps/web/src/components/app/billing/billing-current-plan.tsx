import type { BillingOverview } from "@proofpilot/types";
import {
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Crown,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import {
  formatBillingCycle,
  formatBillingDate,
  formatBillingMoney,
  getBillingStatusLabel,
  getPlanDescription
} from "@/components/app/billing/billing-utils";
import { Badge } from "@/components/ui/badge";

export function BillingCurrentPlan({ overview }: { overview: BillingOverview }) {
  const subscription = overview.subscription;
  const paymentMethod = subscription.paymentMethod;
  const statusVariant =
    subscription.status === "ACTIVE"
      ? "success"
      : subscription.status === "PAST_DUE"
        ? "danger"
        : "secondary";

  return (
    <section
      aria-labelledby="current-plan-heading"
      className="rounded-md border border-primary/45 bg-card p-4 md:p-5"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-md border border-primary/45 bg-primary/10 text-primary md:h-24 md:w-24">
          {subscription.planCode === "PREMIUM" ? (
            <Sparkles className="h-10 w-10" aria-hidden="true" />
          ) : (
            <Crown className="h-10 w-10" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Crown className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase text-primary">Current plan</p>
            {subscription.mode === "DEMO" ? <Badge variant="warning">Demo billing</Badge> : null}
          </div>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl" id="current-plan-heading">
            {subscription.planName}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {getPlanDescription(subscription.planCode)}
          </p>
        </div>
        <div className="col-span-full border-t border-border pt-4 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right">
          <p className="text-2xl font-semibold">
            {formatBillingMoney(subscription.priceCents, subscription.currency)}
            {subscription.priceCents > 0 ? (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {subscription.billingCycle === "ANNUAL" ? "year" : "month"}
              </span>
            ) : null}
          </p>
          <Badge className="mt-2" variant={statusVariant}>
            {getBillingStatusLabel(subscription.status)}
          </Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <PlanFact
          detail={
            subscription.currentPeriodEnd
              ? subscription.cancelAtPeriodEnd
                ? "Ends after this period"
                : "Renews automatically"
              : "No recurring charge"
          }
          icon={CalendarDays}
          label="Renewal date"
          value={formatBillingDate(subscription.currentPeriodEnd)}
        />
        <PlanFact
          detail={
            paymentMethod
              ? `Expires ${String(paymentMethod.expMonth).padStart(2, "0")}/${String(paymentMethod.expYear).slice(-2)}`
              : "No payment method"
          }
          icon={CreditCard}
          label="Payment method"
          value={
            paymentMethod
              ? `${paymentMethod.brand} ending in ${paymentMethod.last4}`
              : "Not configured"
          }
        />
        <PlanFact
          detail={subscription.billingCycle ? "Automatic renewal" : "No recurring charge"}
          icon={CircleDollarSign}
          label="Billing cycle"
          value={formatBillingCycle(subscription.billingCycle)}
        />
      </div>
    </section>
  );
}

interface PlanFactProps {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}

function PlanFact({ detail, icon: Icon, label, value }: PlanFactProps) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3 sm:last:border-r-0">
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
