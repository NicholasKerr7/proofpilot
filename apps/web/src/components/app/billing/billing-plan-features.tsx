import type { BillingOverview } from "@proofpilot/types";
import { CheckCircle2 } from "lucide-react";
import {
  freePlanFeatures,
  premiumPlanFeatures
} from "@/components/app/billing/billing-utils";

export function BillingPlanFeatures({
  planCode
}: {
  planCode: BillingOverview["subscription"]["planCode"];
}) {
  const features = planCode === "PREMIUM" ? premiumPlanFeatures : freePlanFeatures;

  return (
    <section
      aria-labelledby="plan-features-heading"
      className="rounded-md border border-border bg-card p-4 md:p-5"
    >
      <h2 className="text-sm font-semibold uppercase text-primary" id="plan-features-heading">
        Plan features
      </h2>
      <div className="mt-3 divide-y divide-border border-y border-border">
        {features.map((feature) => (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-3" key={feature.label}>
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">{feature.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
