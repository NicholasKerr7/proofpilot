import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  billingPortalSectionOptions,
  type BillingCycle,
  type BillingInvoiceStatus,
  type BillingMode,
  type BillingOverview,
  type BillingPlanCode,
  type BillingPortalSection,
  type BillingSubscriptionStatus,
  type BillingSubscriptionSummary
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import type { BillingInvoiceDocument } from "./invoice-pdf.js";

const gibibyte = 1024 * 1024 * 1024;
const planLimits = {
  FREE: {
    cases: 3,
    storageBytes: gibibyte,
    teamMembers: 1,
    uploads: 50
  },
  PREMIUM: {
    cases: 100,
    storageBytes: 10 * gibibyte,
    teamMembers: 5,
    uploads: 500
  }
} as const;

const subscriptionSelect = {
  billingCycle: true,
  cancelAtPeriodEnd: true,
  currency: true,
  currentPeriodEnd: true,
  mode: true,
  paymentBrand: true,
  paymentExpMonth: true,
  paymentExpYear: true,
  paymentLast4: true,
  plan: true,
  priceCents: true,
  status: true,
  invoices: {
    orderBy: { issuedAt: "desc" as const },
    take: 3,
    select: {
      amountPaidCents: true,
      currency: true,
      id: true,
      invoiceNumber: true,
      issuedAt: true,
      status: true
    }
  }
} as const;

type SubscriptionRecord = {
  billingCycle: string;
  cancelAtPeriodEnd: boolean;
  currency: string;
  currentPeriodEnd: Date;
  mode: string;
  paymentBrand: string | null;
  paymentExpMonth: number | null;
  paymentExpYear: number | null;
  paymentLast4: string | null;
  plan: string;
  priceCents: number;
  status: string;
  invoices: Array<{
    amountPaidCents: number;
    currency: string;
    id: string;
    invoiceNumber: string;
    issuedAt: Date;
    status: string;
  }>;
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string): Promise<BillingOverview> {
    const [subscription, casesUsed, documents, exports] = await Promise.all([
      this.prisma.billingSubscription.findUnique({
        where: { userId },
        select: subscriptionSelect
      }),
      this.prisma.case.count({
        where: { ownerId: userId, archivedAt: null }
      }),
      this.prisma.document.aggregate({
        where: { case: { ownerId: userId } },
        _count: { _all: true },
        _sum: { byteSize: true }
      }),
      this.prisma.packetExport.aggregate({
        where: { packet: { case: { ownerId: userId } } },
        _sum: { byteSize: true }
      })
    ]);
    const summary = subscription
      ? this.toSubscriptionSummary(subscription)
      : this.createFreeSubscription();
    const limits = planLimits[summary.planCode];
    const documentBytes = documents._sum.byteSize ?? 0;
    const exportBytes = exports._sum.byteSize ?? 0;

    return {
      invoices:
        subscription?.invoices.map((invoice) => ({
          amountPaidCents: invoice.amountPaidCents,
          currency: invoice.currency,
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          issuedAt: invoice.issuedAt.toISOString(),
          status: invoice.status as BillingInvoiceStatus
        })) ?? [],
      providerConfigured: false,
      subscription: summary,
      usage: {
        cases: { limit: limits.cases, used: casesUsed },
        storage: {
          limitBytes: limits.storageBytes,
          usedBytes: documentBytes + exportBytes
        },
        teamMembers: { limit: limits.teamMembers, used: 1 },
        uploads: { limit: limits.uploads, used: documents._count._all }
      }
    };
  }

  createPortal(_userId: string, sectionInput: string): never {
    const section = this.validatePortalSection(sectionInput);
    const label = section === "PLAN" ? "Plan management" : "Payment method management";

    throw new ServiceUnavailableException(`${label} is not configured yet.`);
  }

  async getInvoiceDocument(userId: string, invoiceId: string): Promise<BillingInvoiceDocument> {
    if (!invoiceId.trim()) {
      throw new BadRequestException("Invoice id is required.");
    }

    const invoice = await this.prisma.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        subscription: { userId }
      },
      select: {
        amountPaidCents: true,
        currency: true,
        invoiceNumber: true,
        issuedAt: true,
        periodEnd: true,
        periodStart: true,
        status: true,
        subscription: {
          select: {
            billingCycle: true,
            mode: true,
            paymentBrand: true,
            paymentLast4: true,
            plan: true,
            user: {
              select: { email: true, name: true }
            }
          }
        }
      }
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }

    return {
      amountPaidCents: invoice.amountPaidCents,
      billingCycle: invoice.subscription.billingCycle,
      currency: invoice.currency,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      mode: invoice.subscription.mode,
      paymentBrand: invoice.subscription.paymentBrand,
      paymentLast4: invoice.subscription.paymentLast4,
      periodEnd: invoice.periodEnd,
      periodStart: invoice.periodStart,
      planName: getPlanName(invoice.subscription.plan),
      status: invoice.status,
      userEmail: invoice.subscription.user.email,
      userName: invoice.subscription.user.name
    };
  }

  private createFreeSubscription(): BillingSubscriptionSummary {
    return {
      billingCycle: null,
      cancelAtPeriodEnd: false,
      currency: "USD",
      currentPeriodEnd: null,
      mode: null,
      paymentMethod: null,
      planCode: "FREE",
      planName: "Free Plan",
      priceCents: 0,
      status: "ACTIVE"
    };
  }

  private toSubscriptionSummary(record: SubscriptionRecord): BillingSubscriptionSummary {
    const hasPaymentMethod =
      record.paymentBrand !== null &&
      record.paymentLast4 !== null &&
      record.paymentExpMonth !== null &&
      record.paymentExpYear !== null;

    return {
      billingCycle: record.billingCycle as BillingCycle,
      cancelAtPeriodEnd: record.cancelAtPeriodEnd,
      currency: record.currency,
      currentPeriodEnd: record.currentPeriodEnd.toISOString(),
      mode: record.mode as BillingMode,
      paymentMethod: hasPaymentMethod
        ? {
            brand: record.paymentBrand as string,
            expMonth: record.paymentExpMonth as number,
            expYear: record.paymentExpYear as number,
            last4: record.paymentLast4 as string
          }
        : null,
      planCode: record.plan as BillingPlanCode,
      planName: getPlanName(record.plan),
      priceCents: record.priceCents,
      status: record.status as BillingSubscriptionStatus
    };
  }

  private validatePortalSection(section: string): BillingPortalSection {
    if (!billingPortalSectionOptions.includes(section as BillingPortalSection)) {
      throw new BadRequestException("Billing portal section is not supported.");
    }

    return section as BillingPortalSection;
  }
}

function getPlanName(plan: string) {
  return plan === "PREMIUM" ? "Premium Plan" : "Free Plan";
}
