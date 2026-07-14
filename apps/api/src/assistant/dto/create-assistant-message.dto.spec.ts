import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CreateAssistantMessageDto } from "./create-assistant-message.dto.js";

describe("CreateAssistantMessageDto", () => {
  it("trims valid prompt content before validation", async () => {
    const input = plainToInstance(CreateAssistantMessageDto, {
      content: "  Summarize my case  "
    });

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.content).toBe("Summarize my case");
  });

  it("rejects content shorter than two characters after trimming", async () => {
    const input = plainToInstance(CreateAssistantMessageDto, {
      content: "  a  "
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toHaveProperty("minLength");
  });
});
