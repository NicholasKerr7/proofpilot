export interface SanitizeUserTextOptions {
  singleLine?: boolean;
}

const unsafeElementPattern =
  /<\s*(script|style|iframe|object|embed|template|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const markupPattern = /<!--[\s\S]*?-->|<\s*\/?\s*[A-Za-z][^<>]*>|<![^<>]*>/g;
const controlCharacterPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const bidiControlPattern = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export function sanitizeUserText(value: string, options: SanitizeUserTextOptions = {}) {
  const withoutMarkup = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(unsafeElementPattern, "")
    .replace(markupPattern, "")
    .replace(controlCharacterPattern, "")
    .replace(bidiControlPattern, "");

  return (options.singleLine ? withoutMarkup.replace(/\s+/g, " ") : withoutMarkup).trim();
}
