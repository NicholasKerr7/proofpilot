import { ChecklistStatus } from "@proofpilot/database";
import { describe, expect, it } from "vitest";
import { generateCaseSummary } from "./case-summary-generation.js";

describe("generateCaseSummary", () => {
  it("summarizes the saved timeline, evidence coverage, and requested outcome", () => {
    const summary = generateCaseSummary({
      title: "PayPal account closure appeal",
      platform: "PayPal",
      events: [
        {
          occurredAt: new Date("2026-05-12T12:00:00.000Z"),
          title: "Account limitation notice received"
        },
        {
          occurredAt: new Date("2026-05-14T12:00:00.000Z"),
          title: "Support records submitted"
        }
      ],
      checklist: [
        {
          label: "Account ownership proof",
          status: ChecklistStatus.FOUND,
          requirement: { required: true }
        },
        {
          label: "Platform notice",
          status: ChecklistStatus.MISSING,
          requirement: { required: true }
        }
      ],
      documents: [
        {
          originalName: "support-thread.pdf",
          status: "PROCESSED"
        }
      ],
      statement: "A saved appeal statement.",
      requestedOutcome: "Restore account access"
    });

    expect(summary).toContain("2 events from May 12, 2026");
    expect(summary).toContain("1 reviewable file, including support-thread.pdf");
    expect(summary).toContain("Checklist review covers 1 of 2 required evidence items");
    expect(summary).toContain("outstanding items include Platform notice");
    expect(summary).toContain("The requested outcome is: Restore account access.");
  });

  it("reports missing source material honestly", () => {
    const summary = generateCaseSummary({
      title: "Account appeal",
      platform: "ExamplePay",
      events: [],
      checklist: [],
      documents: [],
      statement: null,
      requestedOutcome: null
    });

    expect(summary).toContain("No timeline events have been confirmed yet.");
    expect(summary).toContain("No processed evidence files are available yet.");
    expect(summary).toContain("An appeal statement has not been saved yet.");
  });

  it("keeps generated content within the case summary contract", () => {
    const summary = generateCaseSummary({
      title: "t".repeat(160),
      platform: "p".repeat(80),
      events: [
        { occurredAt: new Date("2026-05-12T12:00:00.000Z"), title: "a".repeat(160) },
        { occurredAt: new Date("2026-05-14T12:00:00.000Z"), title: "b".repeat(160) }
      ],
      checklist: Array.from({ length: 3 }, (_, index) => ({
        label: `${index}`.repeat(160),
        status: ChecklistStatus.MISSING,
        requirement: { required: true }
      })),
      documents: Array.from({ length: 3 }, (_, index) => ({
        originalName: `${index}`.repeat(255),
        status: "PROCESSED"
      })),
      statement: "Saved statement",
      requestedOutcome: "o".repeat(1200)
    });

    expect(summary.length).toBeLessThanOrEqual(2000);
    expect(summary).toHaveLength(2000);
  });
});
