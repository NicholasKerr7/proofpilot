import type { BillingInvoiceSummary } from "@proofpilot/types";
import { Download, FileText } from "lucide-react";
import {
  formatBillingDate,
  formatBillingMoney
} from "@/components/app/billing/billing-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BillingInvoiceListProps {
  billingCycleLabel: string;
  invoices: BillingInvoiceSummary[];
  planName: string;
}

export function BillingInvoiceList({
  billingCycleLabel,
  invoices,
  planName
}: BillingInvoiceListProps) {
  return (
    <section aria-labelledby="recent-invoices-heading" className="rounded-md border border-border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold uppercase text-primary" id="recent-invoices-heading">
        Recent invoices
      </h2>

      {invoices.length ? (
        <div className="mt-3 divide-y divide-border border-y border-border">
          {invoices.map((invoice) => (
            <div
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-3 sm:grid-cols-[auto_minmax(8rem,0.6fr)_minmax(0,1fr)_auto_auto_auto]"
              key={invoice.id}
            >
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-foreground">{formatBillingDate(invoice.issuedAt)}</p>
                <div className="mt-0.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs sm:hidden">
                  <p className="truncate text-muted-foreground">
                    {planName} - {billingCycleLabel}
                  </p>
                  <p className="font-semibold text-foreground">
                    {formatBillingMoney(invoice.amountPaidCents, invoice.currency)}
                  </p>
                </div>
              </div>
              <p className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
                {planName} - {billingCycleLabel}
              </p>
              <p className="hidden text-sm font-semibold text-foreground sm:block">
                {formatBillingMoney(invoice.amountPaidCents, invoice.currency)}
              </p>
              <Badge variant={invoice.status === "PAID" ? "success" : "warning"}>
                {formatInvoiceStatus(invoice.status)}
              </Badge>
              <Button
                aria-label={`Download invoice ${invoice.invoiceNumber}`}
                asChild
                size="icon"
                title={`Download invoice ${invoice.invoiceNumber}`}
                variant="ghost"
              >
                <a href={`/api/billing/invoices/${invoice.id}/download`}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-border bg-secondary/20 px-4 py-5 text-sm text-muted-foreground">
          No invoices are available for this plan.
        </p>
      )}
    </section>
  );
}

function formatInvoiceStatus(status: BillingInvoiceSummary["status"]) {
  const labels: Record<BillingInvoiceSummary["status"], string> = {
    OPEN: "Open",
    PAID: "Paid",
    VOID: "Void"
  };

  return labels[status];
}
