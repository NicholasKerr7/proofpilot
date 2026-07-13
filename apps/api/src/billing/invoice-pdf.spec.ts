import { describe, expect, it } from "vitest";
import { createInvoicePdf } from "./invoice-pdf.js";

describe("createInvoicePdf", () => {
  it("creates a non-empty PDF receipt for an owned invoice record", async () => {
    const pdf = await createInvoicePdf({
      amountPaidCents: 2900,
      billingCycle: "MONTHLY",
      currency: "USD",
      invoiceNumber: "PP-202607-001",
      issuedAt: new Date("2026-07-06T12:00:00.000Z"),
      mode: "DEMO",
      paymentBrand: "VISA",
      paymentLast4: "4242",
      periodEnd: new Date("2026-08-06T12:00:00.000Z"),
      periodStart: new Date("2026-07-06T12:00:00.000Z"),
      planName: "Premium Plan",
      status: "PAID",
      userEmail: "nicholas.kerr@proofpilot.test",
      userName: "Nicholas Kerr"
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1_000);
  });
});
