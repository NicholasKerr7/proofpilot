import { describe, expect, it } from "vitest";
import { analyzeTimelineEvidence } from "./case-timeline-analysis.js";

describe("analyzeTimelineEvidence", () => {
  it("sanitizes evidence-derived event descriptions before persistence", () => {
    const events = analyzeTimelineEvidence([
      {
        id: "document-1",
        originalName: "<b>closure-notice</b>.txt",
        extractedText:
          "<script>alert('hidden')</script><strong>Account closed on July 4, 2026.</strong>\u202E",
        entities: []
      }
    ]);

    expect(events).toEqual([
      expect.objectContaining({
        documentId: "document-1",
        title: "Account action notice received",
        description:
          "Detected July 4, 2026 in closure-notice.txt: Account closed on July 4, 2026."
      })
    ]);
  });
});
