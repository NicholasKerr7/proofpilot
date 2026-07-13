import PDFDocument from "pdfkit";

export interface BillingInvoiceDocument {
  amountPaidCents: number;
  billingCycle: string;
  currency: string;
  invoiceNumber: string;
  issuedAt: Date;
  mode: string;
  paymentBrand: string | null;
  paymentLast4: string | null;
  periodEnd: Date;
  periodStart: Date;
  planName: string;
  status: string;
  userEmail: string;
  userName: string | null;
}

export function createInvoicePdf(invoice: BillingInvoiceDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ margin: 54, size: "LETTER" });

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    document.fillColor("#d97732").fontSize(22).font("Helvetica-Bold").text("ProofPilot");
    document
      .moveDown(0.3)
      .fillColor("#1f2937")
      .fontSize(19)
      .text("Invoice receipt", { align: "right" });
    document
      .fillColor("#15803d")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(invoice.status, { align: "right" });

    document.moveDown(2);
    writeLabelValue(document, "Invoice number", invoice.invoiceNumber);
    writeLabelValue(document, "Issued", formatInvoiceDate(invoice.issuedAt));
    writeLabelValue(
      document,
      "Billing period",
      `${formatInvoiceDate(invoice.periodStart)} - ${formatInvoiceDate(invoice.periodEnd)}`
    );

    document.moveDown(1.5).fillColor("#6b7280").fontSize(9).text("BILL TO");
    document
      .moveDown(0.4)
      .fillColor("#111827")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(invoice.userName ?? "ProofPilot customer");
    document.font("Helvetica").text(invoice.userEmail);

    document.moveDown(2);
    const tableTop = document.y;
    document
      .fillColor("#f3f4f6")
      .rect(54, tableTop, 504, 30)
      .fill();
    document
      .fillColor("#374151")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Description", 66, tableTop + 10)
      .text("Amount", 440, tableTop + 10, { align: "right", width: 106 });
    document
      .fillColor("#111827")
      .font("Helvetica")
      .fontSize(11)
      .text(`${invoice.planName} - ${formatBillingCycle(invoice.billingCycle)}`, 66, tableTop + 46)
      .text(formatMoney(invoice.amountPaidCents, invoice.currency), 440, tableTop + 46, {
        align: "right",
        width: 106
      });

    document
      .moveTo(54, tableTop + 74)
      .lineTo(558, tableTop + 74)
      .strokeColor("#d1d5db")
      .stroke();
    document
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Total paid", 320, tableTop + 90)
      .text(formatMoney(invoice.amountPaidCents, invoice.currency), 440, tableTop + 90, {
        align: "right",
        width: 106
      });

    if (invoice.paymentBrand && invoice.paymentLast4) {
      document
        .moveDown(6)
        .fillColor("#6b7280")
        .font("Helvetica")
        .fontSize(9)
        .text(`Payment method: ${invoice.paymentBrand} ending in ${invoice.paymentLast4}`);
    }

    if (invoice.mode === "DEMO") {
      document
        .moveDown(1)
        .fillColor("#92400e")
        .fontSize(9)
        .text("Demo billing record. No payment was processed by ProofPilot.");
    }

    document
      .font("Helvetica")
      .fillColor("#6b7280")
      .fontSize(8)
      .text("ProofPilot billing support", 54, 718, { align: "center", width: 504 });
    document.end();
  });
}

function formatBillingCycle(value: string) {
  return value === "ANNUAL" ? "Annual" : "Monthly";
}

function formatInvoiceDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(value);
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency"
  }).format(amountCents / 100);
}

function writeLabelValue(document: PDFKit.PDFDocument, label: string, value: string) {
  document.fillColor("#6b7280").font("Helvetica").fontSize(9).text(label);
  document.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text(value);
  document.moveDown(0.6);
}
