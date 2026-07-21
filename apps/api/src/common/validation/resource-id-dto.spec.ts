import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CreateTimelineEventDto } from "../../cases/dto/create-timeline-event.dto.js";
import { ReorderTimelineEventsDto } from "../../cases/dto/reorder-timeline-events.dto.js";
import { UpdateTimelineEventDto } from "../../cases/dto/update-timeline-event.dto.js";
import { CreatePacketShareDto } from "../../packet-sharing/dto/create-packet-share.dto.js";
import { ReportExportQueryDto } from "../../reports/dto/report-export-query.dto.js";
import { ReportSummaryQueryDto } from "../../reports/dto/report-summary-query.dto.js";
import { GlobalSearchQueryDto } from "../../search/dto/global-search-query.dto.js";
import { CreateSupportRequestDto } from "../../support/dto/create-support-request.dto.js";

interface InvalidResourceIdFixture {
  input: object;
  property: string;
}

describe("resource id DTO boundaries", () => {
  const fixtures: InvalidResourceIdFixture[] = [
    {
      input: Object.assign(new ReportSummaryQueryDto(), { caseId: "../other-case" }),
      property: "caseId"
    },
    {
      input: Object.assign(new ReportExportQueryDto(), { caseId: "other/case" }),
      property: "caseId"
    },
    {
      input: Object.assign(new GlobalSearchQueryDto(), { caseId: "other.case" }),
      property: "caseId"
    },
    {
      input: Object.assign(new CreateSupportRequestDto(), {
        caseId: "other case",
        category: "CASE_ASSISTANCE",
        message: "I need help understanding which ownership document is missing.",
        priority: "NORMAL",
        subject: "Help reviewing missing evidence"
      }),
      property: "caseId"
    },
    {
      input: Object.assign(new CreateTimelineEventDto(), {
        documentIds: ["valid-document", "invalid/document"],
        occurredAt: "2026-07-20T12:00:00.000Z",
        title: "Account limitation received"
      }),
      property: "documentIds"
    },
    {
      input: Object.assign(new UpdateTimelineEventDto(), {
        documentIds: ["invalid.document"]
      }),
      property: "documentIds"
    },
    {
      input: Object.assign(new CreatePacketShareDto(), {
        packetExportId: "invalid/export",
        recipients: [{ email: "advisor@example.com", permission: "VIEW" }],
        requireEmailVerification: false,
        watermarkDocuments: false
      }),
      property: "packetExportId"
    },
    {
      input: Object.assign(new ReorderTimelineEventsDto(), {
        eventIds: ["valid-event", "invalid event"]
      }),
      property: "eventIds"
    }
  ];

  it.each(fixtures)("rejects malformed $property values", async ({ input, property }) => {
    const errors = await validate(input);

    expect(errors.map((error) => error.property)).toContain(property);
  });

  it("accepts deterministic demo identifiers", async () => {
    const query = Object.assign(new ReportSummaryQueryDto(), {
      caseId: "demo-nicholas-paypal-appeal"
    });
    const timeline = Object.assign(new CreateTimelineEventDto(), {
      documentIds: ["demo-nicholas-document-1"],
      occurredAt: "2026-07-20T12:00:00.000Z",
      title: "Account limitation received"
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    await expect(validate(timeline)).resolves.toHaveLength(0);
  });
});
