import { analyzeChecklistEvidence, ChecklistStatus } from "@proofpilot/database";
import { describe, expect, it } from "vitest";

const baseChecklistItem = {
  id: "item-1",
  label: "Closure or restriction screenshot",
  description: "Provide the platform notice showing the account restriction.",
  requirementId: "requirement-1",
  status: ChecklistStatus.MISSING,
  manuallyCompletedAt: null,
  required: true
};

describe("checklist evidence analysis", () => {
  it("matches a processed account restriction screenshot", () => {
    const [result] = analyzeChecklistEvidence({
      caseSummary: null,
      checklist: [baseChecklistItem],
      documents: [
        {
          id: "document-1",
          originalName: "account-restriction-notice.png",
          mimeType: "image/png",
          extractedText: "Your account is permanently limited.",
          entities: []
        }
      ]
    });

    expect(result).toMatchObject({
      checklistItemId: baseChecklistItem.id,
      status: ChecklistStatus.FOUND,
      match: {
        documentId: "document-1"
      }
    });
  });

  it("preserves a manual completion when no evidence matches", () => {
    const [result] = analyzeChecklistEvidence({
      caseSummary: null,
      checklist: [
        {
          ...baseChecklistItem,
          manuallyCompletedAt: new Date("2026-07-20T12:00:00.000Z")
        }
      ],
      documents: []
    });

    expect(result).toMatchObject({
      status: ChecklistStatus.COMPLETE,
      match: null
    });
  });

  it("restores an unmatched optional requirement after it is reopened", () => {
    const [result] = analyzeChecklistEvidence({
      caseSummary: null,
      checklist: [
        {
          ...baseChecklistItem,
          status: ChecklistStatus.COMPLETE,
          required: false
        }
      ],
      documents: []
    });

    expect(result).toMatchObject({
      status: ChecklistStatus.OPTIONAL,
      match: null
    });
  });
});
