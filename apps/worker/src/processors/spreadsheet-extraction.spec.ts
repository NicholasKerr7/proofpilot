import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { extractXlsxEvidenceText } from "./spreadsheet-extraction.js";

describe("XLSX evidence extraction", () => {
  it("extracts labeled rows from a workbook", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Order ID", "Status", "Amount"],
      ["A-1001", "Refunded", 42.5]
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    const bytes = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer"
    }) as Buffer;

    const result = extractXlsxEvidenceText(Buffer.from(bytes));

    expect(result).toMatchObject({
      rowCount: 2,
      sheetCount: 1,
      truncated: false
    });
    expect(result.extractedText).toContain("Sheet: Transactions");
    expect(result.extractedText).toContain(
      "Order ID: A-1001 | Status: Refunded | Amount: 42.5"
    );
  });
});
