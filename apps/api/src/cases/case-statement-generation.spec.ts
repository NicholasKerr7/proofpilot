import { ChecklistStatus } from "@proofpilot/database";
import { describe, expect, it } from "vitest";
import { generateAppealStatement } from "./case-statement-generation.js";

describe("generateAppealStatement", () => {
  it("uses persisted guided answers without inventing unsupported facts", () => {
    const statement = generateAppealStatement({
      title: "PayPal account closure appeal",
      platform: "PayPal",
      summary: null,
      deadline: null,
      events: [],
      checklist: [
        {
          label: "Account ownership proof",
          status: ChecklistStatus.FOUND
        }
      ],
      documents: [
        {
          originalName: "account-notice.pdf",
          status: "PROCESSED"
        }
      ],
      guidance: {
        platformAction: "PayPal permanently limited my account",
        actionDate: "The limitation began on May 12, 2026",
        reasonGiven: "The notice referred to an account activity review",
        accountUse: "I used the account for routine business payments",
        supportContact: "I contacted support twice",
        requestedOutcome: "Restore access after reviewing the attached records",
        supportingDocuments: "The restriction notice and support emails are attached"
      }
    });

    expect(statement).toContain("PayPal permanently limited my account.");
    expect(statement).toContain("The limitation began on May 12, 2026.");
    expect(statement).toContain("Account use: I used the account for routine business payments.");
    expect(statement).toContain("Support contact: I contacted support twice.");
    expect(statement).toContain("Restore access after reviewing the attached records.");
    expect(statement).not.toContain("violated");
  });

  it("falls back to explicit placeholders when case context is incomplete", () => {
    const statement = generateAppealStatement({
      title: "Account restriction",
      platform: "ExamplePay",
      summary: null,
      deadline: null,
      events: [],
      checklist: [],
      documents: [],
      guidance: null
    });

    expect(statement).toContain("I am still organizing the key dates");
    expect(statement).toContain("Evidence is being collected");
    expect(statement).toContain("identify the specific records or steps needed");
  });

  it("keeps generated content within the statement storage contract", () => {
    const statement = generateAppealStatement({
      title: "Account restriction",
      platform: "ExamplePay",
      summary: "s".repeat(2000),
      deadline: null,
      events: Array.from({ length: 6 }, (_, index) => ({
        occurredAt: new Date(`2026-05-${String(index + 10).padStart(2, "0")}T12:00:00.000Z`),
        title: `Event ${index + 1}`,
        description: "d".repeat(2000)
      })),
      checklist: [],
      documents: [],
      guidance: {
        platformAction: "p".repeat(500),
        actionDate: "a".repeat(160),
        reasonGiven: "r".repeat(2000),
        accountUse: "u".repeat(2000),
        supportContact: "c".repeat(2000),
        requestedOutcome: "o".repeat(1200),
        supportingDocuments: "e".repeat(2000)
      }
    });

    expect(statement.length).toBeLessThanOrEqual(12000);
    expect(statement).toHaveLength(12000);
  });
});
