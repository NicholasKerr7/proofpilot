import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

const maxSheets = 8;
const maxRowsPerSheet = 200;
const maxColumns = 30;
const maxCellChars = 500;

type SpreadsheetCell = string | number | boolean | Date | null | undefined;

interface SpreadsheetSheet {
  name: string;
  rows: SpreadsheetCell[][];
}

export interface SpreadsheetExtractionResult {
  extractedText: string;
  rowCount: number;
  sheetCount: number;
  truncated: boolean;
}

export function extractCsvEvidenceText(bytes: Buffer): SpreadsheetExtractionResult {
  const decodedText = new TextDecoder("utf-8").decode(bytes);
  const rows = parse(decodedText, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  }) as SpreadsheetCell[][];

  return formatSpreadsheetEvidence({
    sourceLabel: "CSV evidence",
    sheets: [{ name: "CSV", rows }]
  });
}

export function extractXlsxEvidenceText(bytes: Buffer): SpreadsheetExtractionResult {
  const workbook = XLSX.read(bytes, {
    cellDates: true,
    type: "buffer"
  });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = worksheet
      ? XLSX.utils.sheet_to_json<SpreadsheetCell[]>(worksheet, {
          blankrows: false,
          defval: "",
          header: 1,
          raw: false
        })
      : [];

    return {
      name: sheetName,
      rows
    };
  });

  return formatSpreadsheetEvidence({
    sourceLabel: "XLSX evidence",
    sheets
  });
}

function formatSpreadsheetEvidence(input: {
  sourceLabel: string;
  sheets: SpreadsheetSheet[];
}): SpreadsheetExtractionResult {
  const sheetCount = input.sheets.length;
  const rowCount = input.sheets.reduce((total, sheet) => total + sheet.rows.length, 0);
  const selectedSheets = input.sheets.slice(0, maxSheets);
  let truncated = input.sheets.length > selectedSheets.length;
  const lines = [
    input.sourceLabel,
    `Sheets: ${sheetCount}`,
    `Rows: ${rowCount}`,
    ""
  ];

  for (const sheet of selectedSheets) {
    const nonEmptyRows = sheet.rows.filter((row) => row.some((cell) => formatCell(cell)));
    const previewRows = nonEmptyRows.slice(0, maxRowsPerSheet);
    truncated ||= nonEmptyRows.length > previewRows.length;
    lines.push(`Sheet: ${sheet.name}`);
    lines.push(`Rows in sheet: ${nonEmptyRows.length}`);

    if (!previewRows.length) {
      lines.push("No populated rows found.");
      lines.push("");
      continue;
    }

    const headers = buildHeaders(previewRows[0] ?? []);
    lines.push(`Headers: ${headers.join(", ")}`);

    previewRows.forEach((row, index) => {
      const label = index === 0 ? "Header row" : `Row ${index}`;
      lines.push(`${label}: ${formatRow(row, headers)}`);
    });

    lines.push("");
  }

  if (truncated) {
    lines.push(
      `Spreadsheet preview truncated to ${maxSheets} sheet(s), ${maxRowsPerSheet} row(s) per sheet, and ${maxColumns} column(s).`
    );
  }

  return {
    extractedText: lines.join("\n").trim(),
    rowCount,
    sheetCount,
    truncated
  };
}

function buildHeaders(row: SpreadsheetCell[]) {
  const selectedCells = row.slice(0, maxColumns);

  return selectedCells.map((cell, index) => {
    const value = formatCell(cell);
    return value || `Column ${index + 1}`;
  });
}

function formatRow(row: SpreadsheetCell[], headers: string[]) {
  const selectedCells = row.slice(0, headers.length);
  const parts = selectedCells.map((cell, index) => {
    const value = formatCell(cell) || "blank";
    return `${headers[index] ?? `Column ${index + 1}`}: ${value}`;
  });

  return parts.join(" | ");
}

function formatCell(cell: SpreadsheetCell) {
  if (cell === null || cell === undefined) {
    return "";
  }

  const value = cell instanceof Date ? cell.toISOString() : String(cell);
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxCellChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxCellChars)}...`;
}
