import { describe, expect, it } from "vitest";
import { getCaseActivityActionFilter, toCaseActivityItem } from "./case-activity.js";

const createdAt = new Date("2026-07-11T14:30:00.000Z");

describe("case activity presentation", () => {
  it("maps category filters to constrained audit action filters", () => {
    expect(getCaseActivityActionFilter("all")).toBeUndefined();
    expect(getCaseActivityActionFilter("evidence")).toEqual({
      startsWith: "document."
    });
    expect(getCaseActivityActionFilter("case")).toEqual({
      in: ["case.created", "case.updated", "case.archived", "demo.seeded"]
    });
  });

  it("describes changed fields without returning their stored values", () => {
    const item = toCaseActivityItem({
      id: "activity-1",
      action: "case.updated",
      metadata: {
        title: "Sensitive case title",
        summary: "Sensitive case summary",
        unsupportedField: "internal value"
      },
      createdAt
    });

    expect(item).toEqual({
      id: "activity-1",
      action: "case.updated",
      category: "case",
      title: "Case details updated",
      detail: "Title, Summary changed",
      createdAt: createdAt.toISOString()
    });
    expect(item).not.toHaveProperty("metadata");
  });

  it("suppresses internal packet failure details", () => {
    const item = toCaseActivityItem({
      id: "activity-2",
      action: "case.packet_generation_failed",
      metadata: {
        message: "Internal storage provider failure",
        packetId: "packet-private"
      },
      createdAt
    });

    expect(item.detail).toBe("The packet can be retried.");
    expect(item).not.toHaveProperty("metadata");
  });
});
