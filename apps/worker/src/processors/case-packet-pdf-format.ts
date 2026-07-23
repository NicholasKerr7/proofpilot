import type { PreparedInclusion } from "./case-packet-pdf-types.js";

/** Normalizes user and extracted text to PDFKit's supported character range. */
export function sanitizePacketText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\r\n/g, "\n")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0a\x20-\x7e]/g, "?")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

/** Formats a database enum for human-readable packet copy. */
export function formatPacketStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Formats packet dates deterministically in UTC. */
export function formatPacketDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(value);
}

/** Formats byte counts for evidence-index rows. */
export function formatPacketBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** Describes how one evidence item appears in the generated packet. */
export function getPacketInclusionLabel(inclusion: PreparedInclusion) {
  if (inclusion.kind === "attachment") {
    return inclusion.source.kind === "pdf"
      ? `Original PDF appended (${inclusion.pageCount} ${
          inclusion.pageCount === 1 ? "page" : "pages"
        })`
      : "Original image appended (1 page)";
  }

  if (inclusion.kind === "text") {
    return "Extracted text appendix";
  }

  return "Evidence index entry only";
}

/** Combines available inclusion notes without empty separators. */
export function joinPacketNotes(...notes: Array<string | null>) {
  return notes.filter((note): note is string => Boolean(note)).join(" ");
}

/** Truncates footer and image labels to a bounded printable length. */
export function truncatePacketText(value: string, maximumLength: number) {
  if (value.length <= maximumLength) {
    return value;
  }

  return `${value.slice(0, maximumLength - 3)}...`;
}
