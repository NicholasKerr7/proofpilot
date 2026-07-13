import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { BillingService } from "./billing.service.js";

const userId = "user-1";
const periodEnd = new Date("2026-08-06T12:00:00.000Z");

function createSubscription() {
  return {
    billingCycle: "MONTHLY",
    cancelAtPeriodEnd: false,
    currency: "USD",
    currentPeriodEnd: periodEnd,
    mode: "DEMO",
    paymentBrand: "VISA",
    paymentExpMonth: 4,
    paymentExpYear: 2028,
    paymentLast4: "4242",
    plan: "PREMIUM",
    priceCents: 2900,
    status: "ACTIVE",
    invoices: [
      {
        amountPaidCents: 2900,
        currency: "USD",
        id: "invoice-1",
        invoiceNumber: "PP-202607-001",
        issuedAt: new Date("2026-07-06T12:00:00.000Z"),
        status: "PAID"
      }
    ]
  };
}

function createPrismaMock() {
  return {
    billingSubscription: {
      findUnique: vi.fn()
    },
    billingInvoice: {
      findFirst: vi.fn()
    },
    case: {
      count: vi.fn().mockResolvedValue(2)
    },
    document: {
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: 4 },
        _sum: { byteSize: 2_000 }
      })
    },
    packetExport: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { byteSize: 4_000 }
      })
    }
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe("BillingService", () => {
  let prisma: PrismaMock;
  let service: BillingService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new BillingService(prisma as unknown as PrismaService);
  });

  it("returns the owned subscription with usage scoped to the authenticated user", async () => {
    prisma.billingSubscription.findUnique.mockResolvedValue(createSubscription());

    const result = await service.getOverview(userId);

    expect(prisma.billingSubscription.findUnique).toHaveBeenCalledWith({
      where: { userId },
      select: expect.any(Object)
    });
    expect(prisma.case.count).toHaveBeenCalledWith({
      where: { ownerId: userId, archivedAt: null }
    });
    expect(prisma.document.aggregate).toHaveBeenCalledWith({
      where: { case: { ownerId: userId } },
      _count: { _all: true },
      _sum: { byteSize: true }
    });
    expect(prisma.packetExport.aggregate).toHaveBeenCalledWith({
      where: { packet: { case: { ownerId: userId } } },
      _sum: { byteSize: true }
    });
    expect(result).toMatchObject({
      providerConfigured: false,
      subscription: {
        mode: "DEMO",
        paymentMethod: { brand: "VISA", last4: "4242" },
        planCode: "PREMIUM",
        priceCents: 2900
      },
      usage: {
        cases: { limit: 100, used: 2 },
        storage: { limitBytes: 10 * 1024 * 1024 * 1024, usedBytes: 6_000 },
        teamMembers: { limit: 5, used: 1 },
        uploads: { limit: 500, used: 4 }
      }
    });
    expect(result.invoices[0]).toMatchObject({ id: "invoice-1", status: "PAID" });
  });

  it("returns an explicit free-plan fallback when no subscription exists", async () => {
    prisma.billingSubscription.findUnique.mockResolvedValue(null);

    const result = await service.getOverview(userId);

    expect(result.subscription).toMatchObject({
      billingCycle: null,
      mode: null,
      paymentMethod: null,
      planCode: "FREE",
      priceCents: 0,
      status: "ACTIVE"
    });
    expect(result.invoices).toEqual([]);
    expect(result.usage.cases.limit).toBe(3);
  });

  it("rejects invalid portal sections and reports valid provider actions as unavailable", () => {
    expect(() => service.createPortal(userId, "INVOICES")).toThrow(BadRequestException);
    expect(() => service.createPortal(userId, "PLAN")).toThrow(
      ServiceUnavailableException
    );
    expect(() => service.createPortal(userId, "PAYMENT_METHOD")).toThrow(
      ServiceUnavailableException
    );
  });

  it("loads invoice data through the subscription owner relationship", async () => {
    prisma.billingInvoice.findFirst.mockResolvedValue({
      amountPaidCents: 2900,
      currency: "USD",
      invoiceNumber: "PP-202607-001",
      issuedAt: new Date("2026-07-06T12:00:00.000Z"),
      periodEnd: new Date("2026-08-06T12:00:00.000Z"),
      periodStart: new Date("2026-07-06T12:00:00.000Z"),
      status: "PAID",
      subscription: {
        billingCycle: "MONTHLY",
        mode: "DEMO",
        paymentBrand: "VISA",
        paymentLast4: "4242",
        plan: "PREMIUM",
        user: { email: "nicholas@example.com", name: "Nicholas Kerr" }
      }
    });

    const result = await service.getInvoiceDocument(userId, "invoice-1");

    expect(prisma.billingInvoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: "invoice-1",
        subscription: { userId }
      },
      select: expect.any(Object)
    });
    expect(result).toMatchObject({
      invoiceNumber: "PP-202607-001",
      planName: "Premium Plan",
      userEmail: "nicholas@example.com"
    });
  });

  it("does not expose an invoice outside the authenticated user's ownership scope", async () => {
    prisma.billingInvoice.findFirst.mockResolvedValue(null);

    await expect(service.getInvoiceDocument(userId, "invoice-2")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
