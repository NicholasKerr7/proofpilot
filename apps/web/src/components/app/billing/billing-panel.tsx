"use client";

import { useEffect, useState } from "react";
import type {
  BillingOverview,
  BillingPortalSection,
  BillingPortalSession
} from "@proofpilot/types";
import { ArrowLeft, CircleDollarSign, LoaderCircle, RefreshCcw } from "lucide-react";
import { BillingCurrentPlan } from "@/components/app/billing/billing-current-plan";
import { BillingInvoiceList } from "@/components/app/billing/billing-invoice-list";
import { BillingManagement } from "@/components/app/billing/billing-management";
import { BillingPlanFeatures } from "@/components/app/billing/billing-plan-features";
import { formatBillingCycle } from "@/components/app/billing/billing-utils";
import { BillingUsageHighlights } from "@/components/app/billing/billing-usage-highlights";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";

interface BillingPanelProps {
  onBack: () => void;
  onOpenHelp: () => void;
}

type Notice = {
  text: string;
};

export function BillingPanel({ onBack, onOpenHelp }: BillingPanelProps) {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busySection, setBusySection] = useState<BillingPortalSection | null>(null);
  const [pageNotice, setPageNotice] = useState<Notice | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        const nextOverview = await apiRequest<BillingOverview>("/api/billing");

        if (isMounted) {
          setOverview(nextOverview);
          setPageNotice(null);
        }
      } catch (error) {
        if (isMounted) {
          setPageNotice({
            text: error instanceof Error ? error.message : "Billing details could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  async function openPortal(section: BillingPortalSection) {
    setBusySection(section);
    setManagementError(null);

    try {
      const session = await apiRequest<BillingPortalSession>("/api/billing/portal", {
        body: JSON.stringify({ section }),
        method: "POST"
      });
      const destination = new URL(session.url);

      if (destination.protocol !== "https:") {
        throw new Error("Billing portal returned an invalid destination.");
      }

      window.location.assign(destination.toString());
    } catch (error) {
      setManagementError(
        error instanceof Error ? error.message : "Billing management is unavailable."
      );
    } finally {
      setBusySection(null);
    }
  }

  function retry() {
    setIsLoading(true);
    setRefreshKey((currentKey) => currentKey + 1);
  }

  return (
    <section aria-labelledby="billing-heading" className="grid gap-5">
      <div className="flex items-start gap-3">
        <Button
          aria-label="Back to More"
          className="mt-0.5 shrink-0"
          onClick={onBack}
          size="icon"
          title="Back to More"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div>
          <p className="text-sm font-semibold text-primary">Account billing</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="billing-heading">
            Billing &amp; Subscription
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Manage your plan, payment method, and billing history.
          </p>
        </div>
      </div>

      {pageNotice ? <BillingNotice notice={pageNotice} /> : null}

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 rounded-md border border-border bg-card text-sm text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          Loading billing details...
        </div>
      ) : null}

      {!isLoading && !overview ? (
        <div className="grid min-h-48 place-items-center rounded-md border border-border bg-card p-5 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Billing details are unavailable.</p>
            <Button className="mt-4" onClick={retry} type="button" variant="outline">
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {overview ? (
        <>
          <BillingCurrentPlan overview={overview} />
          <BillingUsageHighlights usage={overview.usage} />

          <div className="grid gap-5 md:grid-cols-2">
            <BillingPlanFeatures planCode={overview.subscription.planCode} />
            <BillingManagement
              busySection={busySection}
              error={managementError}
              onOpenHelp={onOpenHelp}
              onOpenPortal={(section) => {
                void openPortal(section);
              }}
              providerConfigured={overview.providerConfigured}
            />
          </div>

          <BillingInvoiceList
            billingCycleLabel={formatBillingCycle(overview.subscription.billingCycle)}
            invoices={overview.invoices}
            planName={overview.subscription.planName}
          />
        </>
      ) : null}
    </section>
  );
}

function BillingNotice({ notice }: { notice: Notice }) {
  return (
    <div
      className="flex min-h-11 items-center gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
      role="alert"
    >
      <CircleDollarSign className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{notice.text}</span>
    </div>
  );
}
