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
        "case.task_created",
        "case.task_updated",
        "case.task_deleted",
        "case.submission_created",
        "case.submission_updated",
        "report.csv_exported",
        "support.request_created",
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

  it("presents packet sharing without exposing recipients or token metadata", () => {
    const item = toCaseActivityItem({
      id: "activity-share",
      action: "case.packet_share_created",
      metadata: {
        recipientCount: 2,
        shareId: "share-private",
        token: "must-not-appear",
        email: "recipient@example.com"
      },
      createdAt
    });

    expect(item).toEqual({
      id: "activity-share",
      action: "case.packet_share_created",
      category: "packet",
      title: "Packet share link created",
      detail: "2 recipients",
      createdAt: createdAt.toISOString()
    });
    expect(item).not.toHaveProperty("metadata");
  });

  it("presents manual checklist completion without exposing internal item IDs", () => {
    const item = toCaseActivityItem({
      id: "activity-checklist",
      action: "case.checklist_item_completed",
      metadata: {
        checklistItemId: "checklist-private",
        label: "Account ownership proof"
      },
      createdAt
    });

    expect(item).toEqual({
      id: "activity-checklist",
      action: "case.checklist_item_completed",
      category: "checklist",
      title: "Checklist item completed",
      detail: "Account ownership proof",
      createdAt: createdAt.toISOString()
    });
    expect(item).not.toHaveProperty("metadata");
  });

  it("presents task workflow state without exposing task content or IDs", () => {
    const item = toCaseActivityItem({
      id: "activity-task",
      action: "case.task_updated",
      metadata: {
        taskId: "task-private",
        title: "Sensitive task title",
        description: "Sensitive task description",
        status: "IN_PROGRESS",
        priority: "HIGH"
      },
      createdAt
    });

    expect(item).toEqual({
      id: "activity-task",
      action: "case.task_updated",
      category: "case",
      title: "Task updated",
      detail: "In progress, High priority",
      createdAt: createdAt.toISOString()
    });
    expect(item).not.toHaveProperty("metadata");
  });

  it("presents a selected-case support request without exposing its message", () => {
    const item = toCaseActivityItem({
      id: "activity-4",
      action: "support.request_created",
      metadata: {
        requestId: "request-1",
        subject: "Help reviewing missing evidence",
        category: "CASE_ASSISTANCE",
        priority: "NORMAL"
      },
      createdAt
    });

    expect(item).toEqual({
      id: "activity-4",
      action: "support.request_created",
      category: "case",
      title: "Support request sent",
      detail: "Help reviewing missing evidence",
      createdAt: createdAt.toISOString()
    });
  });
});
