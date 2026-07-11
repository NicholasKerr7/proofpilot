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
      in: [
        "case.created",
        "case.updated",
        "case.archived",
        "report.csv_exported",
        "demo.seeded"
      ]
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

  it("presents a selected-case report export without exposing export options", () => {
    const item = toCaseActivityItem({
      id: "activity-3",
      action: "report.csv_exported",
      metadata: {
        rowCount: 1,
        sections: ["overview", "evidence"],
        from: "2026-07-01",
        to: "2026-07-31"
      },
      createdAt
    });

    expect(item).toEqual({
      id: "activity-3",
      action: "report.csv_exported",
      category: "case",
      title: "CSV report exported",
      detail: "1 case row",
      createdAt: createdAt.toISOString()
    });
  });
});
