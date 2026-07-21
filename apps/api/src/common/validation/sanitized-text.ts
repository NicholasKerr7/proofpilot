import { Transform } from "class-transformer";
import {
  sanitizeUserText,
  type SanitizeUserTextOptions
} from "@proofpilot/types";

export function SanitizedText(options: SanitizeUserTextOptions = {}) {
  return Transform(({ value }) =>
    typeof value === "string" ? sanitizeUserText(value, options) : value
  );
}
