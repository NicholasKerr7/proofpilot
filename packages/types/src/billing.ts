export const billingPortalSectionOptions = ["PLAN", "PAYMENT_METHOD"] as const;

export type BillingPortalSection = (typeof billingPortalSectionOptions)[number];
export type BillingMode = "DEMO" | "STRIPE";
export type BillingPlanCode = "FREE" | "PREMIUM";
export type BillingSubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type BillingInvoiceStatus = "PAID" | "OPEN" | "VOID";

export interface BillingPaymentMethod {
  brand: string;
  expMonth: number;
  expYear: number;
  last4: string;
}

export interface BillingSubscriptionSummary {
  billingCycle: BillingCycle | null;
  cancelAtPeriodEnd: boolean;
  currency: string;
  currentPeriodEnd: string | null;
  mode: BillingMode | null;
  paymentMethod: BillingPaymentMethod | null;
  planCode: BillingPlanCode;
  planName: string;
  priceCents: number;
  status: BillingSubscriptionStatus;
}

export interface BillingUsage {
  cases: { limit: number; used: number };
  storage: { limitBytes: number; usedBytes: number };
  teamMembers: { limit: number; used: number };
  uploads: { limit: number; used: number };
}

export interface BillingInvoiceSummary {
  amountPaidCents: number;
  currency: string;
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  status: BillingInvoiceStatus;
}

export interface BillingOverview {
  invoices: BillingInvoiceSummary[];
  providerConfigured: boolean;
  subscription: BillingSubscriptionSummary;
  usage: BillingUsage;
}

export interface BillingPortalSession {
  url: string;
}
