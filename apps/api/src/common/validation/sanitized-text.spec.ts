import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  createCaseSchema,
  sanitizeUserText,
  saveStatementSchema
} from "@proofpilot/types";
import { describe, expect, it } from "vitest";
import { CreateAssistantMessageDto } from "../../assistant/dto/create-assistant-message.dto.js";
import { RegisterDto } from "../../auth/dto/register.dto.js";
import { UpdateProfileDto } from "../../auth/dto/update-profile.dto.js";
import { CreateCaseDto } from "../../cases/dto/create-case.dto.js";
import { CreateTimelineEventDto } from "../../cases/dto/create-timeline-event.dto.js";
import { SaveStatementGuidanceDto } from "../../cases/dto/save-statement-guidance.dto.js";
import { SaveStatementDto } from "../../cases/dto/save-statement.dto.js";
import { UpdateCaseDto } from "../../cases/dto/update-case.dto.js";
import { UpdateTimelineEventDto } from "../../cases/dto/update-timeline-event.dto.js";
import { CreateDocumentDto } from "../../documents/dto/create-document.dto.js";
import { CreateReminderDto } from "../../notifications/dto/create-reminder.dto.js";
import { UpdateReminderDto } from "../../notifications/dto/update-reminder.dto.js";
import { CreatePacketShareCommentDto } from "../../packet-sharing/dto/create-packet-share-comment.dto.js";
import { GlobalSearchQueryDto } from "../../search/dto/global-search-query.dto.js";
import { CreateSupportRequestMessageDto } from "../../support/dto/create-support-request-message.dto.js";
import { CreateSupportRequestDto } from "../../support/dto/create-support-request.dto.js";

type DtoConstructor = new () => object;

const unsafeText =
  " \u202E<script>alert('hidden')</script><strong>Safe evidence</strong>\r\nreceived\u0000 ";
const sanitizedDtoFields = [
  [CreateAssistantMessageDto, "content", false],
  [RegisterDto, "name", true],
  [UpdateProfileDto, "name", true],
  [CreateCaseDto, "title", true],
  [CreateCaseDto, "platform", true],
  [CreateCaseDto, "summary", false],
  [UpdateCaseDto, "title", true],
  [UpdateCaseDto, "summary", false],
  [CreateTimelineEventDto, "title", true],
  [CreateTimelineEventDto, "description", false],
  [UpdateTimelineEventDto, "title", true],
  [UpdateTimelineEventDto, "description", false],
  [SaveStatementDto, "content", false],
  [SaveStatementGuidanceDto, "platformAction", false],
  [SaveStatementGuidanceDto, "actionDate", true],
  [SaveStatementGuidanceDto, "reasonGiven", false],
  [SaveStatementGuidanceDto, "accountUse", false],
  [SaveStatementGuidanceDto, "supportContact", false],
  [SaveStatementGuidanceDto, "requestedOutcome", false],
  [SaveStatementGuidanceDto, "supportingDocuments", false],
  [CreateDocumentDto, "originalName", true],
  [CreateReminderDto, "message", false],
  [UpdateReminderDto, "message", false],
  [CreatePacketShareCommentDto, "content", false],
  [GlobalSearchQueryDto, "q", true],
  [CreateSupportRequestDto, "subject", true],
  [CreateSupportRequestDto, "message", false],
  [CreateSupportRequestMessageDto, "message", false]
] satisfies Array<[DtoConstructor, string, boolean]>;

function transformDtoProperty(Dto: DtoConstructor, property: string) {
  return plainToInstance(Dto, { [property]: unsafeText }) as unknown as Record<
    string,
    unknown
  >;
}

describe("sanitizeUserText", () => {
  it("removes markup, unsafe element content, control characters, and bidi overrides", () => {
    expect(sanitizeUserText(unsafeText)).toBe("Safe evidence\nreceived");
  });

  it("preserves ordinary Unicode and comparison characters", () => {
    expect(sanitizeUserText("  Re\u0301sume\u0301 — 東京 & 2 < 3  ")).toBe(
      "Résumé — 東京 & 2 < 3"
    );
  });

  it("collapses whitespace for single-line fields", () => {
    expect(sanitizeUserText(" Case\towner\r\nname ", { singleLine: true })).toBe(
      "Case owner name"
    );
  });

  it.each(sanitizedDtoFields)(
    "sanitizes %s.%s at transformation time",
    (Dto, property, singleLine) => {
      const instance = transformDtoProperty(Dto, property);

      expect(instance[property]).toBe(singleLine ? "Safe evidence received" : "Safe evidence\nreceived");
    }
  );

  it("rejects required fields that become blank after sanitization", async () => {
    const statement = plainToInstance(SaveStatementDto, {
      content: "<script>alert('hidden')</script>"
    });
    const document = plainToInstance(CreateDocumentDto, {
      originalName: "<svg>unsafe</svg>",
      mimeType: "application/pdf",
      byteSize: 1024
    });

    await expect(validate(statement)).resolves.toEqual([
      expect.objectContaining({ property: "content" })
    ]);
    await expect(validate(document)).resolves.toEqual([
      expect.objectContaining({ property: "originalName" })
    ]);
  });

  it("keeps shared Zod contracts aligned with API transformation", () => {
    expect(
      createCaseSchema.parse({
        title: " <b>PayPal</b>\r\nappeal ",
        platform: " PayPal ",
        summary: unsafeText
      })
    ).toMatchObject({
      title: "PayPal appeal",
      platform: "PayPal",
      summary: "Safe evidence\nreceived"
    });
    expect(() => saveStatementSchema.parse({ content: "<script>unsafe()</script>" })).toThrow();
  });
});
