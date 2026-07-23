import type {
  BillingCycle,
  BillingPlanCode,
  BillingSubscriptionStatus
} from "@proofpilot/types";

export const premiumPlanFeatures = [
  {
    description: "Create and manage up to 100 active appeal cases.",
    label: "Advanced case management"
  },
  {
    description: "Secure evidence and packet storage up to 10 GB.",
    label: "Evidence storage"
  },
  {
    description: "Detailed completeness insights and case analytics.",
    label: "Advanced analytics"
  },
  {
    description: "Faster help for account and case questions.",
    label: "Priority support"
  },
  {
    description: "Export case data and generate organized reports.",
    label: "Export and reporting"
  },
  {
    description: "Plan capacity for up to five workspace members.",
    label: "Team collaboration"
  }
] as const;

export const freePlanFeatures = [
  {
    description: "Create and manage up to three active appeal cases.",
    label: "Core case management"
  },
  {
    description: "Secure evidence and packet storage up to 1 GB.",
    label: "Evidence storage"
  },
  {
    description: "Generate and download organized appeal packets.",
    label: "Packet export"
  }
] as const;

export function formatBillingCycle(cycle: BillingCycle | null) {
  if (!cycle) {
    return "Not applicable";
  }

  return cycle === "ANNUAL" ? "Annual" : "Monthly";
}

export function formatBillingDate(value: string | null) {
  if (!value) {
    return "No renewal date";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}

export function formatBillingMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency"
  }).format(amountCents / 100);
}

export function formatBillingStorage(bytes: number) {
  const gibibyte = 1024 * 1024 * 1024;

  if (bytes >= gibibyte) {
    return `${formatDecimal(bytes / gibibyte)} GB`;
  }

  const mebibyte = 1024 * 1024;

  if (bytes >= mebibyte) {
    return `${formatDecimal(bytes / mebibyte)} MB`;
  }

  return bytes === 0 ? "0 GB" : `${formatDecimal(bytes / 1024)} KB`;
}

export function getBillingStatusLabel(status: BillingSubscriptionStatus) {
  const labels: Record<BillingSubscriptionStatus, string> = {
    ACTIVE: "Active",
    CANCELED: "Canceled",
    PAST_DUE: "Past due"
  };

  return labels[status];
}

export function getPlanDescription(planCode: BillingPlanCode) {
  return planCode === "PREMIUM"
    ? "Advanced case management and evidence tools for professionals."
    : "Core tools for building a focused account appeal packet.";
}

export function getUsagePercent(used: number, limit: number) {
  return limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}
