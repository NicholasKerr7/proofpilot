import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { isResourceId, ResourceIdPipe } from "./resource-id.js";

describe("resource id validation", () => {
  const pipe = new ResourceIdPipe();

  it.each([
    "cmrtynvfg000d4r0zk13mzanl",
    "demo-nicholas-paypal-appeal",
    "invoice_2026_07",
    "a".repeat(128)
  ])("accepts supported resource id %s", (value) => {
    expect(isResourceId(value)).toBe(true);
    expect(pipe.transform(value)).toBe(value);
  });

  it.each([
    "",
    "a".repeat(129),
    "../case-id",
    "case.id",
    "case id",
    "case/id",
    "case?id=other",
    null,
    42
  ])("rejects malformed resource id %j", (value) => {
    expect(isResourceId(value)).toBe(false);
    expect(() => pipe.transform(value)).toThrow(BadRequestException);
  });
});
