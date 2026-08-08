import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  generateCasePacketPdf,
  type PacketPdfCase,
  type PacketPdfDocument
} from "../apps/worker/src/processors/case-packet-pdf.js";

const outputDirectory = new URL("../apps/web/public/demo-assets/", import.meta.url);
const passportFixture = new URL(
  "../apps/api/src/connections/fixtures/synthetic-passport.png",
  import.meta.url
);
const caseType = { name: "Account Ban / Appeal Builder" };
const owner = {
  email: "nicholas.kerr@proofpilot.test",
  name: "Nicholas Kerr"
};

const paypalStatement =
  "I am requesting a second review of the permanent limitation placed on my PayPal account. The account supported legitimate customer payments and routine supplier expenses. The attached limitation notice, support correspondence, transaction history, and identity record show that I own the account and that the reviewed activity was ordinary business activity. I respectfully request restored access or a specific explanation of any remaining verification requirement.";

const amazonStatement =
  "I am requesting reinstatement of my Amazon seller account following the fulfillment-rate review. The late shipment metric resulted from a temporary carrier interruption, all affected buyers were contacted, and every delayed order was delivered or refunded. I have updated handling times, enabled backup-carrier routing, and documented a weekly account-health review. The attached records verify account ownership, the affected orders, and the corrective actions now in place.";

async function main() {
  const passportBytes = await readFile(passportFixture);
  const communicationLogBytes = await createCommunicationLogPdf();
  const packets = [
    {
      fileName: "paypal-account-closure-appeal.pdf",
      packet: createPaypalPacket(passportBytes, communicationLogBytes)
    },
    {
      fileName: "amazon-seller-reinstatement-appeal.pdf",
      packet: createAmazonPacket()
    }
  ];

  await mkdir(outputDirectory, { recursive: true });

  for (const { fileName, packet } of packets) {
    const result = await generateCasePacketPdf(packet);
    await writeFile(new URL(fileName, outputDirectory), result.bytes);
    console.log(
      `${fileName}: ${result.pageCount} pages, ${result.bytes.byteLength} bytes, ${result.includedDocumentCount}/${result.indexedDocumentCount} evidence files included`
    );
  }
}

function createPaypalPacket(
  passportBytes: Buffer,
  communicationLogBytes: Uint8Array
): PacketPdfCase {
  const createdAt = new Date("2026-05-01T14:00:00.000Z");
  const updatedAt = new Date("2026-08-07T14:00:00.000Z");
  const limitationNotice = createDocument(
    "limitation-notice.eml",
    "message/rfc822",
    "From: PayPal Support <service@paypal.com>\nDate: May 4, 2026\nSubject: Permanent limitation notice\n\nPayPal placed a permanent limitation on the account after a recent payment review. The account can no longer send or receive payments.",
    { status: "NEEDS_REVIEW" }
  );
  const supportFollowUp = createDocument(
    "support-follow-up.eml",
    "message/rfc822",
    "From: PayPal Support <support@paypal.com>\nDate: May 6, 2026\nSubject: Support follow-up\n\nCase PP-2026-0147 is being evaluated by the account review team. Additional ownership information may be requested.",
    { status: "NEEDS_REVIEW" }
  );
  const transactionHistory = createDocument(
    "transaction-history.csv",
    "text/csv",
    "date,description,amount,status\n2026-05-01,Customer payment,248.00,Completed\n2026-05-03,Supplier payment,75.50,Completed\n2026-05-04,Account limitation,0.00,Restricted",
    { status: "NEEDS_REVIEW" }
  );
  const communicationLog: PacketPdfDocument = {
    ...createDocument(
      "communication-log.pdf",
      "application/pdf",
      "Six-page communication record covering the limitation notice, support contacts, first appeal, denial, identity request, and second-review preparation.",
      { byteSize: 911_360, status: "NEEDS_REVIEW" }
    ),
    supportingContent: {
      bytes: communicationLogBytes,
      kind: "pdf"
    }
  };
  const passport: PacketPdfDocument = {
    ...createDocument(
      "synthetic-passport.png",
      "image/png",
      "Synthetic identity evidence for Nicholas James Kerr. Demonstration data only.",
      { byteSize: passportBytes.byteLength, status: "NEEDS_REVIEW" }
    ),
    supportingContent: {
      bytes: passportBytes,
      kind: "png"
    }
  };
  const documents = [
    limitationNotice,
    supportFollowUp,
    transactionHistory,
    communicationLog,
    passport
  ];

  return {
    id: "demo-nicholas-paypal-appeal",
    title: "PayPal account closure appeal",
    platform: "PayPal",
    summary:
      "PayPal limited the account after a payment review. The packet records the initial denial, the second-review timeline, and the ownership and transaction evidence gathered to address the remaining verification request.",
    deadline: new Date("2026-08-21T17:00:00.000Z"),
    createdAt,
    updatedAt,
    caseType,
    owner,
    checklist: createChecklist([
      ["Account closure or restriction screenshot", "MISSING", null],
      ["Platform support conversation", "NEEDS_REVIEW", supportFollowUp],
      ["User explanation", "COMPLETE", null],
      ["Transaction or activity context", "MISSING", transactionHistory],
      ["Account ownership proof", "NEEDS_REVIEW", passport],
      ["Relevant dates", "COMPLETE", communicationLog]
    ]),
    documents,
    events: [
      createEvent(
        "2026-05-04T14:18:00.000Z",
        "PayPal account limitation notice received",
        "Initial notice said the account was limited after a payment review.",
        limitationNotice
      ),
      createEvent(
        "2026-05-06T16:42:00.000Z",
        "Support ticket opened",
        "Support assigned reference PP-2026-0147 and requested additional ownership evidence.",
        supportFollowUp
      ),
      createEvent(
        "2026-08-04T14:00:00.000Z",
        "Second appeal packet prepared",
        "The statement, transaction context, and synthetic identity evidence were organized for review.",
        passport
      )
    ],
    statements: [{ content: paypalStatement, updatedAt }]
  };
}

function createAmazonPacket(): PacketPdfCase {
  const createdAt = new Date("2026-03-03T15:00:00.000Z");
  const updatedAt = new Date("2026-04-18T18:00:00.000Z");
  const accountHealthNotice = createDocument(
    "account-health-notice.pdf",
    "application/pdf",
    "Amazon Seller Performance notice dated March 3, 2026. The seller account was deactivated after the valid tracking rate and late shipment rate fell below the required threshold. Reference AMZ-SP-88421.",
    { byteSize: 428_610 }
  );
  const supportThread = createDocument(
    "seller-support-thread.eml",
    "message/rfc822",
    "Amazon Seller Support confirmed receipt of the plan of action on March 11, 2026 and requested proof of carrier remediation, affected-order resolution, and updated handling-time controls.",
    { byteSize: 186_220 }
  );
  const fulfillmentSummary = createDocument(
    "order-fulfillment-summary.csv",
    "text/csv",
    "order,ship_by,delivered,resolution\n114-2041,2026-02-21,2026-02-26,Buyer notified\n114-2088,2026-02-22,2026-02-27,Shipping refunded\n114-2110,2026-02-23,2026-02-25,Delivered",
    { byteSize: 12_840 }
  );
  const identityVerification = createDocument(
    "seller-identity-verification.pdf",
    "application/pdf",
    "Seller identity verification for Nicholas Kerr and Northline Studio LLC. The business name, tax profile, payout account ending in 4242, and primary contact email match the suspended seller account.",
    { byteSize: 384_920 }
  );
  const documents = [
    accountHealthNotice,
    supportThread,
    fulfillmentSummary,
    identityVerification
  ];

  return {
    id: "demo-nicholas-amazon-appeal",
    title: "Amazon seller account deactivation appeal",
    platform: "Amazon",
    summary:
      "Amazon deactivated the seller account after a short carrier disruption affected fulfillment metrics. Nicholas documented the affected orders, implemented handling-time and backup-carrier controls, submitted a plan of action, and received reinstatement approval.",
    deadline: null,
    createdAt,
    updatedAt,
    caseType,
    owner,
    checklist: createChecklist([
      ["Account closure or restriction screenshot", "FOUND", accountHealthNotice],
      ["Platform support conversation", "FOUND", supportThread],
      ["User explanation", "COMPLETE", null],
      ["Transaction or activity context", "FOUND", fulfillmentSummary],
      ["Account ownership proof", "FOUND", identityVerification],
      ["Relevant dates", "COMPLETE", accountHealthNotice]
    ]),
    documents,
    events: [
      createEvent(
        "2026-03-03T15:00:00.000Z",
        "Seller account deactivated",
        "The account-health notice identified fulfillment metrics requiring corrective action.",
        accountHealthNotice
      ),
      createEvent(
        "2026-03-11T17:30:00.000Z",
        "Plan of action acknowledged",
        "Seller Support confirmed receipt and requested the carrier-remediation records.",
        supportThread
      ),
      createEvent(
        "2026-03-16T16:00:00.000Z",
        "Corrective evidence submitted",
        "Affected-order resolutions and updated fulfillment controls were added to the appeal.",
        fulfillmentSummary
      ),
      createEvent(
        "2026-03-19T18:10:00.000Z",
        "Seller account reinstated",
        "Amazon approved the appeal and restored selling privileges.",
        supportThread
      )
    ],
    statements: [{ content: amazonStatement, updatedAt }]
  };
}

function createDocument(
  originalName: string,
  mimeType: string,
  extractedText: string,
  options: { byteSize?: number; status?: string } = {}
): PacketPdfDocument {
  return {
    originalName,
    mimeType,
    byteSize: options.byteSize ?? Buffer.byteLength(extractedText),
    status: options.status ?? "PROCESSED",
    createdAt: new Date("2026-03-10T14:00:00.000Z"),
    extractedText,
    supportingContent: null
  };
}

function createChecklist(
  items: Array<[
    label: string,
    status: string,
    document: PacketPdfDocument | null
  ]>
) {
  return items.map(([label, status, document]) => ({
    label,
    description: getRequirementDescription(label),
    status,
    matches: document
      ? [
          {
            confidence: 0.96,
            rationale: `The indexed evidence directly supports ${label.toLowerCase()}.`,
            document: { originalName: document.originalName }
          }
        ]
      : []
  }));
}

function createEvent(
  occurredAt: string,
  title: string,
  description: string,
  document: PacketPdfDocument
) {
  return {
    occurredAt: new Date(occurredAt),
    title,
    description,
    confidence: 0.96,
    sources: [{ document: { originalName: document.originalName } }]
  };
}

async function createCommunicationLogPdf() {
  const document = await PDFDocument.create();
  const headingFont = await document.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await document.embedFont(StandardFonts.Helvetica);
  const entries = [
    ["May 4, 2026", "Permanent limitation notice received", "PayPal reported that a recent payment review resulted in a permanent account limitation."],
    ["May 6, 2026", "Support case opened", "Support assigned reference PP-2026-0147 and confirmed that the account review team was evaluating the case."],
    ["May 12, 2026", "Initial appeal submitted", "The first appeal included the limitation notice and support correspondence."],
    ["May 22, 2026", "Initial appeal denied", "The response did not identify the specific transaction that caused the limitation."],
    ["July 28, 2026", "Identity evidence requested", "Support requested a current government-issued identity document before reconsideration."],
    ["August 4, 2026", "Second-review packet prepared", "Transaction context, account ownership evidence, and a revised statement were organized for review."]
  ] as const;

  entries.forEach(([date, title, detail], index) => {
    const page = document.addPage([595.28, 841.89]);
    page.drawText("PROOFPILOT EVIDENCE RECORD", {
      color: rgb(0.95, 0.32, 0.07),
      font: headingFont,
      size: 12,
      x: 58,
      y: 760
    });
    page.drawText(`Communication log ${index + 1} of ${entries.length}`, {
      color: rgb(0.16, 0.18, 0.2),
      font: headingFont,
      size: 22,
      x: 58,
      y: 704
    });
    page.drawText(date, {
      color: rgb(0.4, 0.42, 0.45),
      font: bodyFont,
      size: 11,
      x: 58,
      y: 670
    });
    page.drawText(title, {
      color: rgb(0.16, 0.18, 0.2),
      font: headingFont,
      size: 15,
      x: 58,
      y: 620
    });
    page.drawText(detail, {
      color: rgb(0.25, 0.27, 0.3),
      font: bodyFont,
      lineHeight: 18,
      maxWidth: 470,
      size: 11,
      x: 58,
      y: 580
    });
    page.drawText("Synthetic portfolio evidence. No real account data.", {
      color: rgb(0.48, 0.5, 0.52),
      font: bodyFont,
      size: 8,
      x: 58,
      y: 52
    });
  });

  return document.save({ useObjectStreams: false });
}

function getRequirementDescription(label: string) {
  const descriptions: Record<string, string> = {
    "Account closure or restriction screenshot":
      "A screenshot or PDF showing the closure, suspension, hold, or restriction notice.",
    "Platform support conversation":
      "Emails, chats, tickets, or support responses related to the account action.",
    "User explanation":
      "A clear statement explaining what happened and the outcome requested.",
    "Transaction or activity context":
      "Receipts, order records, screenshots, or logs that explain the account activity.",
    "Account ownership proof":
      "Evidence tying the user to the account, such as profile details or account emails.",
    "Relevant dates":
      "Dates of account action, support contact, previous appeals, or deadlines."
  };

  return descriptions[label] ?? label;
}

const restoreSystemClock = freezeSystemClock(
  new Date("2026-08-07T18:00:00.000Z").getTime()
);

void main().then(restoreSystemClock).catch((error: unknown) => {
  restoreSystemClock();
  console.error(error);
  process.exitCode = 1;
});

function freezeSystemClock(timestamp: number) {
  const SystemDate = Date;
  const FixedDate = function (this: Date, ...args: unknown[]) {
    if (!new.target) {
      return new SystemDate(timestamp).toString();
    }

    return Reflect.construct(
      SystemDate,
      args.length ? args : [timestamp],
      new.target
    );
  };

  Object.setPrototypeOf(FixedDate, SystemDate);
  FixedDate.prototype = SystemDate.prototype;
  Object.defineProperty(FixedDate, "now", { value: () => timestamp });
  globalThis.Date = FixedDate as unknown as DateConstructor;

  return () => {
    globalThis.Date = SystemDate;
  };
}
