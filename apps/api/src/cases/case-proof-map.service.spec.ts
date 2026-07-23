import { ChecklistStatus, DocumentStatus } from "@proofpilot/database";
import { describe, expect, it } from "vitest";
import { buildProofMapResponse } from "./case-proof-map.service.js";

type ProofMapRecord = Parameters<typeof buildProofMapResponse>[0];

function createProofMapRecord(): ProofMapRecord {
  return {
    id: "case-1",
    checklist: [
      {
        id: "checklist-action",
        description: "The original platform notice.",
        label: "Account closure or restriction screenshot",
        status: ChecklistStatus.FOUND,
        matches: [
          {
            id: "match-action",
            confidence: 0.91,
            rationale: "The notice names the account limitation.",
            document: {
              extractedText:
                "PayPal placed a permanent limitation on Nicholas Kerr's account after a recent payment review.",
              id: "document-notice",
              originalName: "limitation-notice.eml",
              status: DocumentStatus.PROCESSED
            }
          }
        ]
      },
      {
        id: "checklist-owner",
        description: "Records tying Nicholas to the account.",
        label: "Account ownership proof",
        status: ChecklistStatus.MISSING,
        matches: []
      }
    ],
    events: [
      {
        description: "The limitation notice arrived by email.",
        id: "event-notice",
        occurredAt: new Date("2026-05-04T14:18:00.000Z"),
        title: "Account limitation notice received",
        sources: [{ documentId: "document-notice" }]
      }
    ],
    statementGuidance: {
      accountUse: "The account handled ordinary customer payments.",
      actionDate: "May 4, 2026",
      platformAction: "PayPal permanently limited the account.",
      reasonGiven: "The notice cited a payment review.",
      requestedOutcome: "Restore access after reviewing the records.",
      supportContact: "Support confirmed the review.",
      supportingDocuments: "The case still needs ownership proof."
    },
    statements: [
      {
        content: "I request restoration of my PayPal account.",
        id: "statement-1"
      }
    ]
  };
}

describe("buildProofMapResponse", () => {
  it("connects a claim to exact evidence, timeline, and statement sources", () => {
    const result = buildProofMapResponse(
      createProofMapRecord(),
      new Date("2026-05-10T12:00:00.000Z")
    );
    const actionClaim = result.claims[0];

    expect(result.generatedAt).toBe("2026-05-10T12:00:00.000Z");
    expect(actionClaim).toMatchObject({
      label: "The account action is documented",
      sourceKinds: ["EVIDENCE", "TIMELINE", "STATEMENT"],
      status: "SUPPORTED",
      strength: 96
    });
    expect(actionClaim?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: "document-notice",
          excerpt: expect.stringContaining("permanent limitation"),
          kind: "EVIDENCE"
        }),
        expect.objectContaining({
          eventId: "event-notice",
          kind: "TIMELINE"
        }),
        expect.objectContaining({
          excerpt: expect.stringContaining("PayPal permanently limited"),
          kind: "STATEMENT"
        })
      ])
    );
  });

  it("keeps an unsupported requirement visible as a missing claim", () => {
    const result = buildProofMapResponse(createProofMapRecord());
    const ownershipClaim = result.claims[1];

    expect(ownershipClaim).toMatchObject({
      label: "Account ownership is established",
      sourceKinds: [],
      status: "MISSING",
      strength: 10
    });
    expect(ownershipClaim?.gaps).toContain(
      "Attach documentary evidence that directly supports this claim."
    );
    expect(result.summary).toMatchObject({
      missing: 1,
      supported: 1,
      total: 2
    });
  });
});
