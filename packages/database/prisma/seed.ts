import { config } from "dotenv";
import {
  AppealSubmissionChannel,
  AppealSubmissionStatus,
  AssistantMessageRole,
  AssistantResponseMode,
  BillingCycle,
  BillingMode,
  BillingPlan,
  CaseCollaboratorRole,
  CaseCollaboratorStatus,
  CaseStatus,
  ChecklistStatus,
  ConnectionMode,
  ConnectionProvider,
  DocumentSource,
  DocumentStatus,
  InvoiceStatus,
  PacketStatus,
  SubscriptionStatus,
  SupportMessageAuthor,
  SupportRequestCategory,
  SupportRequestPriority,
  SupportRequestStatus,
  SubmissionUpdateType,
  TaskPriority,
  TaskStatus,
  closePrismaClient,
  getPrismaClient
} from "../src/index.js";
import { createHash } from "node:crypto";

config({ path: new URL("../../../.env", import.meta.url) });

const prisma = getPrismaClient();
const demoUser = {
  email: "nicholas.kerr@proofpilot.test",
  name: "Nicholas Kerr",
  passwordHash: "$2b$12$X2xny4j4VEX.7qkHfRntBeF3JgkZ9BT3ydepVYXyAoAsnBi2D4vNO",
  passwordChangedAt: new Date("2026-04-10T12:00:00.000Z")
};

const requirements = [
  {
    label: "Account closure or restriction screenshot",
    description: "A screenshot or PDF showing the closure, suspension, hold, or restriction notice.",
    sortOrder: 1
  },
  {
    label: "Platform support conversation",
    description: "Emails, chats, tickets, or support responses related to the account action.",
    sortOrder: 2
  },
  {
    label: "User explanation",
    description: "A clear statement explaining what happened and the outcome requested.",
    sortOrder: 3
  },
  {
    label: "Transaction or activity context",
    description: "Receipts, order records, screenshots, or logs that explain the account activity.",
    sortOrder: 4
  },
  {
    label: "Account ownership proof",
    description: "Evidence tying the user to the account, such as profile details or account emails.",
    sortOrder: 5
  },
  {
    label: "Relevant dates",
    description: "Dates of account action, support contact, previous appeals, or deadlines.",
    sortOrder: 6
  }
];

const demoCaseId = "demo-nicholas-paypal-appeal";
const demoStatementId = "demo-nicholas-paypal-statement";
const demoAmazonCaseId = "demo-nicholas-amazon-appeal";
const demoAmazonStatementId = "demo-nicholas-amazon-statement";
const demoCaseSummary =
  "PayPal limited the account after a payment review. The saved timeline covers the restriction notice, support contact, and appeal preparation. Current evidence includes the limitation notice and account records, with ownership proof still being gathered. Nicholas is requesting restored access or a specific explanation of any remaining requirements.";
const demoEvidence = [
  {
    id: "demo-nicholas-document-limitation",
    checklistItemId: "demo-nicholas-checklist-1",
    confidence: 0.94,
    content:
      "From: PayPal Support <service@paypal.com>\nDate: May 4, 2026\nSubject: Permanent limitation notice\n\nHello Nicholas, PayPal has placed a permanent limitation on your account after a recent payment review. You can no longer use the account to send or receive payments.",
    entity: { type: "DATE", value: "2026-05-04" },
    eventId: "demo-nicholas-event-restriction",
    mimeType: "message/rfc822",
    originalName: "limitation-notice.eml",
    rationale: "The email directly records the permanent account limitation and review date.",
    source: DocumentSource.GMAIL_IMPORT,
    sourceReference: "gmail-limitation-notice"
  },
  {
    id: "demo-nicholas-document-support",
    checklistItemId: "demo-nicholas-checklist-2",
    confidence: 0.88,
    content:
      "From: PayPal Support <support@paypal.com>\nDate: May 6, 2026\nSubject: Support follow-up\n\nThanks for contacting PayPal. Case PP-2026-0147 is being evaluated by the account review team. We will contact you if additional information is required.",
    entity: { type: "REFERENCE", value: "PP-2026-0147" },
    eventId: "demo-nicholas-event-support",
    mimeType: "message/rfc822",
    originalName: "support-follow-up.eml",
    rationale: "The support response confirms the ticket reference and review status.",
    source: DocumentSource.GMAIL_IMPORT,
    sourceReference: "gmail-support-follow-up"
  },
  {
    id: "demo-nicholas-document-transactions",
    checklistItemId: "demo-nicholas-checklist-4",
    confidence: 0.86,
    content:
      "date,description,amount,status\n2026-05-01,Customer payment,248.00,Completed\n2026-05-03,Supplier payment,75.50,Completed\n2026-05-04,Account limitation,0.00,Restricted",
    entity: { type: "AMOUNT", value: "248.00" },
    eventId: null,
    mimeType: "text/csv",
    originalName: "transaction-history.csv",
    rationale: "The activity export provides dated context for ordinary completed payments.",
    source: DocumentSource.GOOGLE_DRIVE_IMPORT,
    sourceReference: "drive-transaction-history"
  },
  {
    id: "demo-nicholas-document-communication-log",
    byteSize: 911_360,
    checklistItemId: "demo-nicholas-checklist-6",
    confidence: 0.92,
    content:
      "Communication record for PayPal case PP-2026-0147. May 4: permanent limitation notice received. May 6: support case opened. May 12: initial appeal submitted. May 22: initial appeal denied. July 28: identity evidence requested. August 4: second-review packet prepared.",
    entity: { type: "REFERENCE", value: "PP-2026-0147" },
    eventId: "demo-nicholas-event-support",
    mimeType: "application/pdf",
    originalName: "communication-log.pdf",
    rationale: "The dated communication record supports the sequence of platform contacts and appeal actions.",
    source: DocumentSource.GOOGLE_DRIVE_IMPORT,
    sourceReference: "drive-communication-log"
  },
  {
    id: "demo-nicholas-document-passport",
    byteSize: 2_513_852,
    checklistItemId: "demo-nicholas-checklist-5",
    confidence: 0.97,
    content:
      "Synthetic passport identity page for Nicholas James Kerr. Generated demonstration evidence for case PP-2026-0147; it does not represent a real identity document.",
    entity: { type: "PERSON", value: "Nicholas James Kerr" },
    eventId: null,
    mimeType: "image/png",
    originalName: "synthetic-passport.png",
    rationale: "The synthetic identity page demonstrates account ownership evidence without using real identity data.",
    source: DocumentSource.GOOGLE_DRIVE_IMPORT,
    sourceReference: "drive-identity-verification"
  }
] as const;

async function main() {
  const caseType = await prisma.caseType.upsert({
    where: { slug: "account-ban-appeal" },
    update: {
      name: "Account Ban / Appeal Builder",
      description: "Build an organized appeal packet for account bans, holds, closures, and platform restrictions."
    },
    create: {
      slug: "account-ban-appeal",
      name: "Account Ban / Appeal Builder",
      description: "Build an organized appeal packet for account bans, holds, closures, and platform restrictions."
    }
  });

  const template = await prisma.caseTemplate.upsert({
    where: { id: "account-ban-appeal-template" },
    update: {
      caseTypeId: caseType.id,
      name: "Account Ban Appeal Template",
      description: "Minimum evidence checklist for a credible account restriction appeal."
    },
    create: {
      id: "account-ban-appeal-template",
      caseTypeId: caseType.id,
      name: "Account Ban Appeal Template",
      description: "Minimum evidence checklist for a credible account restriction appeal."
    }
  });

  for (const requirement of requirements) {
    await prisma.templateRequirement.upsert({
      where: {
        id: `account-ban-${requirement.sortOrder}`
      },
      update: {
        ...requirement,
        templateId: template.id,
        required: true
      },
      create: {
        id: `account-ban-${requirement.sortOrder}`,
        ...requirement,
        templateId: template.id,
        required: true
      }
    });
  }

  const user = await prisma.user.upsert({
    where: { email: demoUser.email },
    update: {
      name: demoUser.name,
      passwordHash: demoUser.passwordHash,
      passwordChangedAt: demoUser.passwordChangedAt
    },
    create: demoUser
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      accentColor: "COPPER",
      analyticsUsageData: false,
      autoSave: true,
      cloudSync: true,
      confirmBeforeDelete: true,
      defaultCaseStatus: CaseStatus.DRAFT,
      emailNotifications: true,
      exportFormat: "PDF",
      inAppNotifications: true,
      itemsPerPage: 25,
      marketingCommunications: false,
      notifyCaseUpdates: true,
      notifyDeadlineReminders: true,
      notifyEvidenceProcessing: true,
      notifyPacketReady: true,
      reduceMotion: false,
      syncOverCellular: false,
      theme: "DARK"
    },
    create: {
      id: "demo-nicholas-preferences",
      userId: user.id
    }
  });

  const connectionNow = new Date();
  const demoConnections = [
    {
      id: "demo-nicholas-connection-gmail",
      provider: ConnectionProvider.GMAIL,
      accountLabel: "nicholas.kerr@gmail.com",
      lastSyncedAt: addMinutes(connectionNow, -2)
    },
    {
      id: "demo-nicholas-connection-google-drive",
      provider: ConnectionProvider.GOOGLE_DRIVE,
      accountLabel: "nicholas.kerr@gmail.com",
      lastSyncedAt: addMinutes(connectionNow, -15)
    },
    {
      id: "demo-nicholas-connection-dropbox",
      provider: ConnectionProvider.DROPBOX,
      accountLabel: demoUser.email,
      lastSyncedAt: addMinutes(connectionNow, -60)
    },
    {
      id: "demo-nicholas-connection-paypal",
      provider: ConnectionProvider.PAYPAL,
      accountLabel: demoUser.email,
      lastSyncedAt: addMinutes(connectionNow, -30)
    }
  ];

  for (const connection of demoConnections) {
    await prisma.connectedAccount.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: connection.provider
        }
      },
      update: {
        accountLabel: connection.accountLabel,
        lastSyncedAt: connection.lastSyncedAt,
        mode: ConnectionMode.DEMO
      },
      create: {
        ...connection,
        mode: ConnectionMode.DEMO,
        userId: user.id
      }
    });
  }

  const billingPeriodStart = getBillingPeriodStart(new Date(), 6);
  const billingPeriodEnd = addMonths(billingPeriodStart, 1);
  const subscription = await prisma.billingSubscription.upsert({
    where: { userId: user.id },
    update: {
      billingCycle: BillingCycle.MONTHLY,
      cancelAtPeriodEnd: false,
      currency: "USD",
      currentPeriodEnd: billingPeriodEnd,
      currentPeriodStart: billingPeriodStart,
      mode: BillingMode.DEMO,
      paymentBrand: "VISA",
      paymentExpMonth: 4,
      paymentExpYear: 2028,
      paymentLast4: "4242",
      plan: BillingPlan.PREMIUM,
      priceCents: 2900,
      status: SubscriptionStatus.ACTIVE
    },
    create: {
      id: "demo-nicholas-subscription",
      billingCycle: BillingCycle.MONTHLY,
      currency: "USD",
      currentPeriodEnd: billingPeriodEnd,
      currentPeriodStart: billingPeriodStart,
      mode: BillingMode.DEMO,
      paymentBrand: "VISA",
      paymentExpMonth: 4,
      paymentExpYear: 2028,
      paymentLast4: "4242",
      plan: BillingPlan.PREMIUM,
      priceCents: 2900,
      status: SubscriptionStatus.ACTIVE,
      userId: user.id
    }
  });

  for (let invoiceIndex = 0; invoiceIndex < 3; invoiceIndex += 1) {
    const issuedAt = addMonths(billingPeriodStart, -invoiceIndex);
    const invoicePeriodEnd = addMonths(issuedAt, 1);

    await prisma.billingInvoice.upsert({
      where: { id: `demo-nicholas-invoice-${invoiceIndex + 1}` },
      update: {
        amountPaidCents: 2900,
        currency: "USD",
        invoiceNumber: createInvoiceNumber(issuedAt),
        issuedAt,
        periodEnd: invoicePeriodEnd,
        periodStart: issuedAt,
        status: InvoiceStatus.PAID,
        subscriptionId: subscription.id
      },
      create: {
        id: `demo-nicholas-invoice-${invoiceIndex + 1}`,
        amountPaidCents: 2900,
        currency: "USD",
        invoiceNumber: createInvoiceNumber(issuedAt),
        issuedAt,
        periodEnd: invoicePeriodEnd,
        periodStart: issuedAt,
        status: InvoiceStatus.PAID,
        subscriptionId: subscription.id
      }
    });
  }

  const deadline = addDays(new Date(), 14);
  const reminderDate = addDays(new Date(), 10);

  const demoCase = await prisma.case.upsert({
    where: { id: demoCaseId },
    update: {
      caseTypeId: caseType.id,
      deadline,
      ownerId: user.id,
      platform: "PayPal",
      status: CaseStatus.NEEDS_MORE_EVIDENCE,
      summary: demoCaseSummary,
      title: "PayPal account closure appeal"
    },
    create: {
      id: demoCaseId,
      caseTypeId: caseType.id,
      deadline,
      ownerId: user.id,
      platform: "PayPal",
      status: CaseStatus.NEEDS_MORE_EVIDENCE,
      summary: demoCaseSummary,
      title: "PayPal account closure appeal"
    }
  });

  await prisma.caseSharingSettings.upsert({
    where: { caseId: demoCase.id },
    update: {
      invitationExpiryDays: 7,
      preventDownloads: false
    },
    create: {
      id: "demo-nicholas-case-sharing-settings",
      caseId: demoCase.id,
      invitationExpiryDays: 7,
      preventDownloads: false
    }
  });

  const collaborationNow = new Date();
  const demoCollaborators = [
    {
      id: "demo-nicholas-collaborator-jane",
      acceptedAt: addDays(collaborationNow, -5),
      email: "jane.smith@legalgroup.test",
      invitedAt: addDays(collaborationNow, -6),
      name: "Jane Smith",
      role: CaseCollaboratorRole.EDITOR
    },
    {
      id: "demo-nicholas-collaborator-alex",
      acceptedAt: addDays(collaborationNow, -3),
      email: "alex.patel@evidencehub.test",
      invitedAt: addDays(collaborationNow, -4),
      name: "Alex Patel",
      role: CaseCollaboratorRole.VIEWER
    }
  ];

  for (const collaborator of demoCollaborators) {
    await prisma.caseCollaborator.upsert({
      where: {
        caseId_email: {
          caseId: demoCase.id,
          email: collaborator.email
        }
      },
      update: {
        acceptedAt: collaborator.acceptedAt,
        expiresAt: null,
        invitedAt: collaborator.invitedAt,
        name: collaborator.name,
        role: collaborator.role,
        status: CaseCollaboratorStatus.ACTIVE
      },
      create: {
        ...collaborator,
        caseId: demoCase.id,
        status: CaseCollaboratorStatus.ACTIVE
      }
    });
  }

  for (const requirement of requirements) {
    await prisma.caseChecklistItem.upsert({
      where: { id: `demo-nicholas-checklist-${requirement.sortOrder}` },
      update: {
        caseId: demoCase.id,
        description: requirement.description,
        label: requirement.label,
        manuallyCompletedAt: null,
        requirementId: `account-ban-${requirement.sortOrder}`,
        status: getDemoChecklistStatus(requirement.sortOrder)
      },
      create: {
        id: `demo-nicholas-checklist-${requirement.sortOrder}`,
        caseId: demoCase.id,
        description: requirement.description,
        label: requirement.label,
        manuallyCompletedAt: null,
        requirementId: `account-ban-${requirement.sortOrder}`,
        status: getDemoChecklistStatus(requirement.sortOrder)
      }
    });
  }

  const demoEvents = [
    {
      id: "demo-nicholas-event-restriction",
      occurredAt: addDays(new Date(), -12),
      title: "PayPal account limitation notice received",
      description: "Initial notice said the account was limited after a payment review."
    },
    {
      id: "demo-nicholas-event-support",
      occurredAt: addDays(new Date(), -10),
      title: "Support ticket opened",
      description: "Requested the reason for the limitation and asked which documents were needed."
    },
    {
      id: "demo-nicholas-event-appeal-draft",
      occurredAt: addDays(new Date(), -3),
      title: "Appeal packet draft started",
      description: "Started collecting ownership proof, account screenshots, and transaction context."
    }
  ];

  for (const [sortOrder, event] of demoEvents.entries()) {
    await prisma.caseEvent.upsert({
      where: { id: event.id },
      update: {
        caseId: demoCase.id,
        description: event.description,
        occurredAt: event.occurredAt,
        sortOrder,
        title: event.title
      },
      create: {
        id: event.id,
        caseId: demoCase.id,
        confidence: null,
        description: event.description,
        occurredAt: event.occurredAt,
        sortOrder,
        title: event.title
      }
    });
  }

  for (const evidence of demoEvidence) {
    const storageKey = `demo-samples/evidence/${evidence.originalName}`;
    const byteSize = "byteSize" in evidence
      ? evidence.byteSize
      : Buffer.byteLength(evidence.content);
    const sha256 = createHash("sha256")
      .update(evidence.content)
      .digest("hex");

    await prisma.document.upsert({
      where: { id: evidence.id },
      update: {
        byteSize,
        caseId: demoCase.id,
        extractedText: evidence.content,
        mimeType: evidence.mimeType,
        originalName: evidence.originalName,
        sha256,
        source: evidence.source,
        sourceReference: evidence.sourceReference,
        status: DocumentStatus.NEEDS_REVIEW,
        storageKey
      },
      create: {
        id: evidence.id,
        byteSize,
        caseId: demoCase.id,
        extractedText: evidence.content,
        mimeType: evidence.mimeType,
        originalName: evidence.originalName,
        sha256,
        source: evidence.source,
        sourceReference: evidence.sourceReference,
        status: DocumentStatus.NEEDS_REVIEW,
        storageKey
      }
    });
    await prisma.documentEntity.upsert({
      where: { id: `${evidence.id}-entity` },
      update: {
        confidence: evidence.confidence,
        documentId: evidence.id,
        type: evidence.entity.type,
        value: evidence.entity.value
      },
      create: {
        id: `${evidence.id}-entity`,
        confidence: evidence.confidence,
        documentId: evidence.id,
        type: evidence.entity.type,
        value: evidence.entity.value
      }
    });
    await prisma.documentProcessingLog.upsert({
      where: { id: `${evidence.id}-processing` },
      update: {
        documentId: evidence.id,
        message: "Sample extraction is ready for review.",
        status: "COMPLETED",
        step: "TEXT_EXTRACTION"
      },
      create: {
        id: `${evidence.id}-processing`,
        documentId: evidence.id,
        message: "Sample extraction is ready for review.",
        status: "COMPLETED",
        step: "TEXT_EXTRACTION"
      }
    });
    await prisma.caseRequirementMatch.upsert({
      where: { id: `${evidence.id}-match` },
      update: {
        checklistItemId: evidence.checklistItemId,
        confidence: evidence.confidence,
        documentId: evidence.id,
        rationale: evidence.rationale,
        requirementId: `account-ban-${evidence.checklistItemId.split("-").at(-1)}`
      },
      create: {
        id: `${evidence.id}-match`,
        checklistItemId: evidence.checklistItemId,
        confidence: evidence.confidence,
        documentId: evidence.id,
        rationale: evidence.rationale,
        requirementId: `account-ban-${evidence.checklistItemId.split("-").at(-1)}`
      }
    });

    if (evidence.eventId) {
      await prisma.eventSource.upsert({
        where: { id: `${evidence.id}-event-source` },
        update: {
          documentId: evidence.id,
          eventId: evidence.eventId
        },
        create: {
          id: `${evidence.id}-event-source`,
          documentId: evidence.id,
          eventId: evidence.eventId
        }
      });
    }
  }

  const firstStatementDraft =
    "I am requesting a review of my PayPal account limitation. The account was used for legitimate payments and routine business activity. Please review the attached notice and support correspondence and restore access.";
  const statementContent =
    "I am requesting a second review of the permanent limitation placed on my PayPal account. The account supported legitimate customer payments and routine supplier expenses. The attached limitation notice, support correspondence, transaction history, and identity record show that I own the account and that the reviewed activity was ordinary business activity. I respectfully request restored access or a specific explanation of any remaining verification requirement.";

  await prisma.caseStatement.upsert({
    where: { id: demoStatementId },
    update: {
      caseId: demoCase.id,
      content: statementContent
    },
    create: {
      id: demoStatementId,
      caseId: demoCase.id,
      content: statementContent
    }
  });

  await prisma.statementVersion.upsert({
    where: { id: "demo-nicholas-paypal-statement-v1" },
    update: {
      content: firstStatementDraft,
      statementId: demoStatementId,
      version: 1
    },
    create: {
      id: "demo-nicholas-paypal-statement-v1",
      content: firstStatementDraft,
      statementId: demoStatementId,
      version: 1
    }
  });

  await prisma.statementVersion.upsert({
    where: { id: "demo-nicholas-paypal-statement-v2" },
    update: {
      content: statementContent,
      statementId: demoStatementId,
      version: 2
    },
    create: {
      id: "demo-nicholas-paypal-statement-v2",
      content: statementContent,
      statementId: demoStatementId,
      version: 2
    }
  });

  await prisma.statementGuidance.upsert({
    where: { caseId: demoCase.id },
    update: {
      platformAction: "PayPal permanently limited my account after a payment review.",
      actionDate: "The limitation notice arrived five days ago.",
      reasonGiven: "The notice referred to a review of recent account activity.",
      accountUse: "I used the account for legitimate customer payments and routine business activity.",
      supportContact: "I contacted support and began gathering the records requested for review.",
      requestedOutcome:
        "Restore account access after reviewing the attached evidence, or identify the specific information still required.",
      supportingDocuments:
        "The case includes the limitation notice, support correspondence, account records, and transaction context."
    },
    create: {
      id: "demo-nicholas-paypal-statement-guidance",
      caseId: demoCase.id,
      platformAction: "PayPal permanently limited my account after a payment review.",
      actionDate: "The limitation notice arrived five days ago.",
      reasonGiven: "The notice referred to a review of recent account activity.",
      accountUse: "I used the account for legitimate customer payments and routine business activity.",
      supportContact: "I contacted support and began gathering the records requested for review.",
      requestedOutcome:
        "Restore account access after reviewing the attached evidence, or identify the specific information still required.",
      supportingDocuments:
        "The case includes the limitation notice, support correspondence, account records, and transaction context."
    }
  });

  await prisma.caseSummary.upsert({
    where: { id: "demo-nicholas-paypal-summary-v1" },
    update: {
      caseId: demoCase.id,
      content: demoCaseSummary
    },
    create: {
      id: "demo-nicholas-paypal-summary-v1",
      caseId: demoCase.id,
      content: demoCaseSummary
    }
  });

  const paypalPacketCreatedAt = addMinutes(new Date(), -240);
  const paypalPacket = await prisma.casePacket.upsert({
    where: { id: "demo-nicholas-paypal-packet" },
    update: {
      caseId: demoCase.id,
      createdAt: paypalPacketCreatedAt,
      status: PacketStatus.READY
    },
    create: {
      id: "demo-nicholas-paypal-packet",
      caseId: demoCase.id,
      createdAt: paypalPacketCreatedAt,
      status: PacketStatus.READY
    }
  });

  await prisma.packetExport.upsert({
    where: { id: "demo-nicholas-paypal-packet-export" },
    update: {
      byteSize: 2_631_883,
      createdAt: paypalPacketCreatedAt,
      includedDocumentCount: 5,
      indexedDocumentCount: 5,
      packetId: paypalPacket.id,
      pageCount: 12,
      storageKey: "demo-samples/packets/paypal-account-closure-appeal.pdf"
    },
    create: {
      id: "demo-nicholas-paypal-packet-export",
      byteSize: 2_631_883,
      createdAt: paypalPacketCreatedAt,
      includedDocumentCount: 5,
      indexedDocumentCount: 5,
      packetId: paypalPacket.id,
      pageCount: 12,
      storageKey: "demo-samples/packets/paypal-account-closure-appeal.pdf"
    }
  });

  const submissionCreatedAt = addDays(new Date(), -26);
  const submissionResolvedAt = addDays(new Date(), -16);
  const demoSubmission = await prisma.caseSubmission.upsert({
    where: { id: "demo-nicholas-submission-round-1" },
    update: {
      caseId: demoCase.id,
      channel: AppealSubmissionChannel.WEB_PORTAL,
      confirmationCode: "PP-2026-0147",
      destination: "PayPal Resolution Center",
      notes:
        "The initial appeal was submitted with the limitation notice and support correspondence.",
      resolvedAt: submissionResolvedAt,
      responseDueAt: addDays(new Date(), -12),
      round: 1,
      status: AppealSubmissionStatus.DENIED,
      submittedAt: submissionCreatedAt
    },
    create: {
      id: "demo-nicholas-submission-round-1",
      caseId: demoCase.id,
      channel: AppealSubmissionChannel.WEB_PORTAL,
      confirmationCode: "PP-2026-0147",
      destination: "PayPal Resolution Center",
      notes:
        "The initial appeal was submitted with the limitation notice and support correspondence.",
      resolvedAt: submissionResolvedAt,
      responseDueAt: addDays(new Date(), -12),
      round: 1,
      status: AppealSubmissionStatus.DENIED,
      submittedAt: submissionCreatedAt
    }
  });
  const demoSubmissionUpdates = [
    {
      id: "demo-nicholas-submission-update-submitted",
      details:
        "Submitted the initial appeal through the permanent limitation review form.",
      occurredAt: submissionCreatedAt,
      status: AppealSubmissionStatus.SUBMITTED,
      title: "Initial appeal submitted",
      type: SubmissionUpdateType.STATUS_CHANGE
    },
    {
      id: "demo-nicholas-submission-update-acknowledged",
      details:
        "PayPal confirmed receipt and assigned reference PP-2026-0147.",
      occurredAt: addDays(new Date(), -25),
      status: AppealSubmissionStatus.ACKNOWLEDGED,
      title: "Appeal receipt confirmed",
      type: SubmissionUpdateType.ACKNOWLEDGEMENT
    },
    {
      id: "demo-nicholas-submission-update-review",
      details:
        "The account review team began evaluating the submitted records.",
      occurredAt: addDays(new Date(), -22),
      status: AppealSubmissionStatus.UNDER_REVIEW,
      title: "Appeal moved to account review",
      type: SubmissionUpdateType.STATUS_CHANGE
    },
    {
      id: "demo-nicholas-submission-update-denied",
      details:
        "The initial appeal was denied without identifying the specific activity that caused the permanent limitation. Round two is being prepared with clearer transaction context and ownership proof.",
      occurredAt: submissionResolvedAt,
      status: AppealSubmissionStatus.DENIED,
      title: "Initial appeal denied",
      type: SubmissionUpdateType.DECISION
    }
  ];

  for (const update of demoSubmissionUpdates) {
    await prisma.submissionUpdate.upsert({
      where: { id: update.id },
      update: {
        details: update.details,
        occurredAt: update.occurredAt,
        status: update.status,
        submissionId: demoSubmission.id,
        title: update.title,
        type: update.type
      },
      create: {
        ...update,
        submissionId: demoSubmission.id
      }
    });
  }

  const assistantNow = new Date();
  const assistantThread = await prisma.assistantThread.upsert({
    where: {
      userId_caseId: {
        userId: user.id,
        caseId: demoCase.id
      }
    },
    update: {
      title: "PayPal appeal guidance"
    },
    create: {
      id: "demo-nicholas-assistant-thread",
      userId: user.id,
      caseId: demoCase.id,
      title: "PayPal appeal guidance"
    }
  });

  await prisma.assistantMessage.upsert({
    where: { id: "demo-nicholas-assistant-user-message" },
    update: {
      content: "Can you review my statement and suggest ways to make it more compelling?",
      createdAt: addMinutes(assistantNow, -2),
      role: AssistantMessageRole.USER,
      threadId: assistantThread.id
    },
    create: {
      id: "demo-nicholas-assistant-user-message",
      content: "Can you review my statement and suggest ways to make it more compelling?",
      createdAt: addMinutes(assistantNow, -2),
      role: AssistantMessageRole.USER,
      threadId: assistantThread.id
    }
  });

  await prisma.assistantMessage.upsert({
    where: { id: "demo-nicholas-assistant-guided-message" },
    update: {
      content:
        "Your saved statement has a clear request and identifies the records you are collecting. To make it stronger:\n\n- Add the exact limitation date and support ticket date.\n- Explain the legitimate payment activity with one or two specific examples.\n- Describe the account-security steps you completed after the limitation.\n- End with the precise outcome you want from PayPal.\n\nGuided mode reviewed your saved case fields and did not change the statement.",
      createdAt: addMinutes(assistantNow, -1),
      responseMode: AssistantResponseMode.GUIDED,
      role: AssistantMessageRole.ASSISTANT,
      threadId: assistantThread.id
    },
    create: {
      id: "demo-nicholas-assistant-guided-message",
      content:
        "Your saved statement has a clear request and identifies the records you are collecting. To make it stronger:\n\n- Add the exact limitation date and support ticket date.\n- Explain the legitimate payment activity with one or two specific examples.\n- Describe the account-security steps you completed after the limitation.\n- End with the precise outcome you want from PayPal.\n\nGuided mode reviewed your saved case fields and did not change the statement.",
      createdAt: addMinutes(assistantNow, -1),
      responseMode: AssistantResponseMode.GUIDED,
      role: AssistantMessageRole.ASSISTANT,
      threadId: assistantThread.id
    }
  });

  await prisma.reminder.upsert({
    where: { id: "demo-nicholas-reminder-review" },
    update: {
      caseId: demoCase.id,
      completedAt: null,
      message: "Review missing evidence before the PayPal appeal deadline.",
      remindAt: reminderDate,
      sentAt: null
    },
    create: {
      id: "demo-nicholas-reminder-review",
      caseId: demoCase.id,
      completedAt: null,
      message: "Review missing evidence before the PayPal appeal deadline.",
      remindAt: reminderDate
    }
  });

  const taskNow = new Date();
  const demoTasks = [
    {
      id: "demo-nicholas-task-identity",
      title: "Upload proof of identity",
      description: "Provide a valid government-issued ID.",
      priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      progress: 40,
      dueAt: addDays(taskNow, 2)
    },
    {
      id: "demo-nicholas-task-communication",
      title: "Review communication log",
      description: "Verify all platform communications and support notes.",
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      progress: 0,
      dueAt: addDays(taskNow, 4)
    },
    {
      id: "demo-nicholas-task-statement",
      title: "Finalize statement draft",
      description: "Complete and polish the appeal statement.",
      priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      progress: 60,
      dueAt: addDays(taskNow, 6)
    },
    {
      id: "demo-nicholas-task-preview",
      title: "Regenerate packet preview",
      description: "Refresh the packet after the remaining ownership evidence is confirmed.",
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      progress: 0,
      dueAt: addDays(taskNow, 8)
    },
    {
      id: "demo-nicholas-task-evidence",
      title: "Upload additional evidence",
      description: "Add supporting documents and account screenshots.",
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      progress: 0,
      dueAt: addDays(taskNow, 8)
    },
    {
      id: "demo-nicholas-task-notes",
      title: "Add supporting notes",
      description: "Include context and explanations for the reviewer.",
      priority: TaskPriority.LOW,
      status: TaskStatus.REVIEW,
      progress: 90,
      dueAt: addDays(taskNow, 9)
    },
    {
      id: "demo-nicholas-task-submit",
      title: "Submit appeal",
      description: "Send the completed appeal package to PayPal.",
      priority: TaskPriority.LOW,
      status: TaskStatus.TODO,
      progress: 0,
      dueAt: addDays(taskNow, 12)
    },
    {
      id: "demo-nicholas-task-response",
      title: "Review PayPal response",
      description: "Record the latest platform response in the case timeline.",
      priority: TaskPriority.LOW,
      status: TaskStatus.COMPLETED,
      progress: 100,
      dueAt: addDays(taskNow, -1)
    }
  ];

  for (const task of demoTasks) {
    const completedAt =
      task.status === TaskStatus.COMPLETED ? addDays(taskNow, -1) : null;

    await prisma.caseTask.upsert({
      where: { id: task.id },
      update: {
        caseId: demoCase.id,
        completedAt,
        description: task.description,
        dueAt: task.dueAt,
        priority: task.priority,
        progress: task.progress,
        status: task.status,
        title: task.title
      },
      create: {
        ...task,
        caseId: demoCase.id,
        completedAt
      }
    });
  }

  const inboxNow = new Date();
  const demoSupportRequest = await prisma.supportRequest.upsert({
    where: { id: "demo-nicholas-support-appeal" },
    update: {
      caseId: demoCase.id,
      category: SupportRequestCategory.CASE_ASSISTANCE,
      createdAt: addMinutes(inboxNow, -210),
      message:
        "Could you review my PayPal appeal packet and confirm whether any identity evidence is still missing?",
      priority: SupportRequestPriority.HIGH,
      readAt: null,
      status: SupportRequestStatus.IN_PROGRESS,
      subject: "PayPal account closure appeal",
      updatedAt: addMinutes(inboxNow, -18),
      userId: user.id
    },
    create: {
      id: "demo-nicholas-support-appeal",
      caseId: demoCase.id,
      category: SupportRequestCategory.CASE_ASSISTANCE,
      createdAt: addMinutes(inboxNow, -210),
      message:
        "Could you review my PayPal appeal packet and confirm whether any identity evidence is still missing?",
      priority: SupportRequestPriority.HIGH,
      readAt: null,
      status: SupportRequestStatus.IN_PROGRESS,
      subject: "PayPal account closure appeal",
      updatedAt: addMinutes(inboxNow, -18),
      userId: user.id
    }
  });

  const demoSupportMessages = [
    {
      id: "demo-nicholas-support-message-review",
      author: SupportMessageAuthor.SUPPORT,
      createdAt: addMinutes(inboxNow, -150),
      message:
        "Hi Nicholas. We reviewed your appeal packet and still need a clear copy of a current government-issued ID."
    },
    {
      id: "demo-nicholas-support-message-question",
      author: SupportMessageAuthor.USER,
      createdAt: addMinutes(inboxNow, -118),
      message: "What types of identification can I upload for the appeal?"
    },
    {
      id: "demo-nicholas-support-message-guidance",
      author: SupportMessageAuthor.SUPPORT,
      createdAt: addMinutes(inboxNow, -92),
      message:
        "A passport, driver's license, or state ID will work. Make sure the document is clear, in color, and not expired."
    },
    {
      id: "demo-nicholas-support-message-confirmation",
      author: SupportMessageAuthor.USER,
      createdAt: addMinutes(inboxNow, -46),
      message: "I have added my driver's license to the evidence vault."
    },
    {
      id: "demo-nicholas-support-message-followup",
      author: SupportMessageAuthor.SUPPORT,
      createdAt: addMinutes(inboxNow, -18),
      message:
        "Thanks for providing the additional evidence. We will revalidate the packet and let you know if anything else is needed."
    }
  ];

  for (const supportMessage of demoSupportMessages) {
    await prisma.supportRequestMessage.upsert({
      where: { id: supportMessage.id },
      update: {
        ...supportMessage,
        requestId: demoSupportRequest.id
      },
      create: {
        ...supportMessage,
        requestId: demoSupportRequest.id
      }
    });
  }

  await prisma.notification.upsert({
    where: { id: "demo-nicholas-notification-welcome" },
    update: {
      body: "A PayPal appeal case is ready for evidence review.",
      caseId: demoCase.id,
      createdAt: addMinutes(inboxNow, -58),
      inAppVisible: true,
      readAt: null,
      title: "Demo case ready",
      type: "demo_case_ready",
      userId: user.id
    },
    create: {
      id: "demo-nicholas-notification-welcome",
      body: "A PayPal appeal case is ready for evidence review.",
      caseId: demoCase.id,
      createdAt: addMinutes(inboxNow, -58),
      title: "Demo case ready",
      type: "demo_case_ready",
      userId: user.id
    }
  });

  const demoInboxNotifications = [
    {
      id: "demo-nicholas-notification-team",
      body: "Please upload a clear copy of your ID so the case team can finalize the appeal.",
      createdAt: addMinutes(inboxNow, -74),
      readAt: null,
      title: "Additional documentation needed",
      type: "inbox_team_message"
    },
    {
      id: "demo-nicholas-notification-packet",
      body: "Your latest PayPal appeal packet preview is ready for review.",
      createdAt: addMinutes(inboxNow, -240),
      readAt: addMinutes(inboxNow, -180),
      title: "Packet PP-2026-7909 is complete",
      type: "packet_ready"
    },
    {
      id: "demo-nicholas-notification-reminder",
      body: "Review the remaining evidence before the PayPal appeal deadline.",
      createdAt: addDays(inboxNow, -2),
      readAt: addDays(inboxNow, -1),
      title: "Upcoming appeal deadline",
      type: "deadline_reminder"
    }
  ];

  for (const notification of demoInboxNotifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: {
        ...notification,
        caseId: demoCase.id,
        inAppVisible: true,
        userId: user.id
      },
      create: {
        ...notification,
        caseId: demoCase.id,
        inAppVisible: true,
        userId: user.id
      }
    });
  }

  const activityNow = new Date();
  const demoActivityLogs: Array<{
    action: string;
    createdAt: Date;
    id: string;
    metadata: Record<string, string | number>;
  }> = [
    {
      id: "demo-nicholas-audit-case-created",
      action: "case.created",
      createdAt: addDays(activityNow, -12),
      metadata: { platform: demoCase.platform, title: demoCase.title }
    },
    {
      id: "demo-nicholas-audit-timeline-created",
      action: "case.timeline_event_created",
      createdAt: addDays(activityNow, -3),
      metadata: {
        eventId: "demo-nicholas-event-appeal-draft",
        title: "Appeal packet draft started"
      }
    },
    {
      id: "demo-nicholas-audit-reminder-created",
      action: "case.reminder_created",
      createdAt: addMinutes(activityNow, -220),
      metadata: {
        reminderId: "demo-nicholas-reminder-review",
        remindAt: reminderDate.toISOString()
      }
    },
    {
      id: "demo-nicholas-audit-statement-saved",
      action: "case.statement_saved",
      createdAt: addMinutes(activityNow, -165),
      metadata: { statementId: demoStatementId, version: 2 }
    },
    {
      id: "demo-nicholas-audit-packet-generated",
      action: "case.packet_generated",
      createdAt: addMinutes(activityNow, -240),
      metadata: {
        includedDocumentCount: 5,
        indexedDocumentCount: 5,
        packetId: paypalPacket.id,
        pageCount: 12
      }
    },
    {
      id: "demo-nicholas-audit-checklist-analyzed",
      action: "case.checklist_analyzed",
      createdAt: addMinutes(activityNow, -110),
      metadata: { foundCount: 2, missingCount: 4, documentsAnalyzed: 0, matchCount: 0 }
    },
    {
      id: "demo-nicholas-audit-timeline-analyzed",
      action: "case.timeline_analyzed",
      createdAt: addMinutes(activityNow, -55),
      metadata: { documentsAnalyzed: 0, eventCount: demoEvents.length }
    },
    {
      id: "demo-nicholas-audit-seeded",
      action: "demo.seeded",
      createdAt: addMinutes(activityNow, -20),
      metadata: { email: user.email, title: demoCase.title }
    },
    {
      id: "demo-nicholas-audit-collaboration-invited",
      action: "case.collaboration_invited",
      createdAt: addDays(activityNow, -6),
      metadata: {
        collaboratorId: "demo-nicholas-collaborator-jane",
        role: CaseCollaboratorRole.EDITOR,
        status: CaseCollaboratorStatus.PENDING
      }
    },
    {
      id: "demo-nicholas-audit-collaboration-role-updated",
      action: "case.collaboration_role_updated",
      createdAt: addDays(activityNow, -2),
      metadata: {
        collaboratorId: "demo-nicholas-collaborator-alex",
        role: CaseCollaboratorRole.VIEWER
      }
    }
  ];

  for (const activityLog of demoActivityLogs) {
    await prisma.auditLog.upsert({
      where: { id: activityLog.id },
      update: {
        action: activityLog.action,
        caseId: demoCase.id,
        createdAt: activityLog.createdAt,
        metadata: activityLog.metadata,
        userId: user.id
      },
      create: {
        ...activityLog,
        caseId: demoCase.id,
        userId: user.id
      }
    });
  }

  const loginActivityNow = new Date();
  const demoLoginActivity = [
    {
      id: "demo-nicholas-login-ipad",
      createdAt: addDays(loginActivityNow, -1),
      deviceLabel: "iPad Pro",
      locationLabel: "San Francisco, CA"
    },
    {
      id: "demo-nicholas-login-iphone",
      createdAt: addDays(loginActivityNow, -2),
      deviceLabel: "iPhone 15 Pro",
      locationLabel: "San Francisco, CA"
    },
    {
      id: "demo-nicholas-login-macbook",
      createdAt: addDays(loginActivityNow, -3),
      deviceLabel: "MacBook Pro",
      locationLabel: "San Francisco, CA"
    },
    {
      id: "demo-nicholas-login-windows",
      createdAt: addDays(loginActivityNow, -5),
      deviceLabel: "Chrome on Windows",
      locationLabel: "New York, NY"
    },
    {
      id: "demo-nicholas-login-safari",
      createdAt: addDays(loginActivityNow, -7),
      deviceLabel: "Safari on iPhone",
      locationLabel: "Los Angeles, CA"
    }
  ];

  for (const loginActivity of demoLoginActivity) {
    await prisma.auditLog.upsert({
      where: { id: loginActivity.id },
      update: {
        action: "auth.logged_in",
        caseId: null,
        createdAt: loginActivity.createdAt,
        metadata: {
          deviceLabel: loginActivity.deviceLabel,
          locationLabel: loginActivity.locationLabel,
          securityActivity: true
        },
        userId: user.id
      },
      create: {
        id: loginActivity.id,
        action: "auth.logged_in",
        createdAt: loginActivity.createdAt,
        metadata: {
          deviceLabel: loginActivity.deviceLabel,
          locationLabel: loginActivity.locationLabel,
          securityActivity: true
        },
        userId: user.id
      }
    });
  }

  await seedResolvedAmazonCase({
    caseTypeId: caseType.id,
    userId: user.id
  });
}

async function seedResolvedAmazonCase(input: { caseTypeId: string; userId: string }) {
  const caseCreatedAt = new Date("2026-03-03T15:00:00.000Z");
  const caseUpdatedAt = new Date("2026-04-18T18:00:00.000Z");
  const submittedAt = new Date("2026-03-11T17:30:00.000Z");
  const resolvedAt = new Date("2026-03-19T18:10:00.000Z");
  const amazonSummary =
    "Amazon deactivated the seller account after a short carrier disruption affected fulfillment metrics. Nicholas documented the affected orders, implemented handling-time and backup-carrier controls, submitted a plan of action, and received reinstatement approval.";
  const amazonStatementDraft =
    "I am requesting reinstatement of my Amazon seller account. A temporary carrier interruption caused several late shipments, and all affected buyers have now been contacted.";
  const amazonStatement =
    "I am requesting reinstatement of my Amazon seller account following the fulfillment-rate review. The late shipment metric resulted from a temporary carrier interruption, all affected buyers were contacted, and every delayed order was delivered or refunded. I have updated handling times, enabled backup-carrier routing, and documented a weekly account-health review. The attached records verify account ownership, the affected orders, and the corrective actions now in place.";
  const amazonCase = await prisma.case.upsert({
    where: { id: demoAmazonCaseId },
    update: {
      archivedAt: null,
      caseTypeId: input.caseTypeId,
      createdAt: caseCreatedAt,
      deadline: null,
      ownerId: input.userId,
      platform: "Amazon",
      status: CaseStatus.RESOLVED,
      summary: amazonSummary,
      title: "Amazon seller account deactivation appeal",
      updatedAt: caseUpdatedAt
    },
    create: {
      id: demoAmazonCaseId,
      caseTypeId: input.caseTypeId,
      createdAt: caseCreatedAt,
      deadline: null,
      ownerId: input.userId,
      platform: "Amazon",
      status: CaseStatus.RESOLVED,
      summary: amazonSummary,
      title: "Amazon seller account deactivation appeal",
      updatedAt: caseUpdatedAt
    }
  });

  for (const requirement of requirements) {
    const manuallyCompleted = requirement.sortOrder === 3 || requirement.sortOrder === 6;

    await prisma.caseChecklistItem.upsert({
      where: { id: `demo-nicholas-amazon-checklist-${requirement.sortOrder}` },
      update: {
        caseId: amazonCase.id,
        description: requirement.description,
        label: requirement.label,
        manuallyCompletedAt: manuallyCompleted ? resolvedAt : null,
        requirementId: `account-ban-${requirement.sortOrder}`,
        status: manuallyCompleted ? ChecklistStatus.COMPLETE : ChecklistStatus.FOUND
      },
      create: {
        id: `demo-nicholas-amazon-checklist-${requirement.sortOrder}`,
        caseId: amazonCase.id,
        createdAt: caseCreatedAt,
        description: requirement.description,
        label: requirement.label,
        manuallyCompletedAt: manuallyCompleted ? resolvedAt : null,
        requirementId: `account-ban-${requirement.sortOrder}`,
        status: manuallyCompleted ? ChecklistStatus.COMPLETE : ChecklistStatus.FOUND
      }
    });
  }

  const amazonEvents = [
    {
      id: "demo-nicholas-amazon-event-deactivated",
      occurredAt: caseCreatedAt,
      title: "Seller account deactivated",
      description:
        "The account-health notice identified fulfillment metrics requiring corrective action."
    },
    {
      id: "demo-nicholas-amazon-event-acknowledged",
      occurredAt: submittedAt,
      title: "Plan of action acknowledged",
      description:
        "Seller Support confirmed receipt and requested carrier-remediation records."
    },
    {
      id: "demo-nicholas-amazon-event-evidence",
      occurredAt: new Date("2026-03-16T16:00:00.000Z"),
      title: "Corrective evidence submitted",
      description:
        "Affected-order resolutions and updated fulfillment controls were added to the appeal."
    },
    {
      id: "demo-nicholas-amazon-event-reinstated",
      occurredAt: resolvedAt,
      title: "Seller account reinstated",
      description: "Amazon approved the appeal and restored selling privileges."
    }
  ];

  for (const [sortOrder, event] of amazonEvents.entries()) {
    await prisma.caseEvent.upsert({
      where: { id: event.id },
      update: {
        caseId: amazonCase.id,
        confidence: 0.96,
        description: event.description,
        occurredAt: event.occurredAt,
        sortOrder,
        title: event.title
      },
      create: {
        ...event,
        caseId: amazonCase.id,
        confidence: 0.96,
        createdAt: event.occurredAt,
        sortOrder
      }
    });
  }

  const amazonEvidence = [
    {
      id: "demo-nicholas-amazon-document-health-notice",
      byteSize: 428_610,
      content:
        "Amazon Seller Performance notice dated March 3, 2026. The seller account was deactivated after the valid tracking rate and late shipment rate fell below the required threshold. Reference AMZ-SP-88421.",
      entity: { type: "REFERENCE", value: "AMZ-SP-88421" },
      eventIds: [
        "demo-nicholas-amazon-event-deactivated"
      ],
      mimeType: "application/pdf",
      originalName: "account-health-notice.pdf",
      requirementSortOrders: [1, 6],
      source: DocumentSource.GOOGLE_DRIVE_IMPORT,
      sourceReference: "amazon-account-health-notice"
    },
    {
      id: "demo-nicholas-amazon-document-support-thread",
      byteSize: 186_220,
      content:
        "Amazon Seller Support confirmed receipt of the plan of action on March 11, 2026 and requested proof of carrier remediation, affected-order resolution, and updated handling-time controls. On March 19, support confirmed that selling privileges were restored.",
      entity: { type: "DATE", value: "2026-03-19" },
      eventIds: [
        "demo-nicholas-amazon-event-acknowledged",
        "demo-nicholas-amazon-event-reinstated"
      ],
      mimeType: "message/rfc822",
      originalName: "seller-support-thread.eml",
      requirementSortOrders: [2],
      source: DocumentSource.GMAIL_IMPORT,
      sourceReference: "amazon-seller-support-thread"
    },
    {
      id: "demo-nicholas-amazon-document-orders",
      byteSize: 12_840,
      content:
        "order,ship_by,delivered,resolution\n114-2041,2026-02-21,2026-02-26,Buyer notified\n114-2088,2026-02-22,2026-02-27,Shipping refunded\n114-2110,2026-02-23,2026-02-25,Delivered",
      entity: { type: "ORDER", value: "114-2041" },
      eventIds: ["demo-nicholas-amazon-event-evidence"],
      mimeType: "text/csv",
      originalName: "order-fulfillment-summary.csv",
      requirementSortOrders: [4],
      source: DocumentSource.GOOGLE_DRIVE_IMPORT,
      sourceReference: "amazon-order-fulfillment-summary"
    },
    {
      id: "demo-nicholas-amazon-document-identity",
      byteSize: 384_920,
      content:
        "Seller identity verification for Nicholas Kerr and Northline Studio LLC. The business name, tax profile, payout account ending in 4242, and primary contact email match the suspended seller account.",
      entity: { type: "ORGANIZATION", value: "Northline Studio LLC" },
      eventIds: ["demo-nicholas-amazon-event-evidence"],
      mimeType: "application/pdf",
      originalName: "seller-identity-verification.pdf",
      requirementSortOrders: [5],
      source: DocumentSource.GOOGLE_DRIVE_IMPORT,
      sourceReference: "amazon-seller-identity-verification"
    }
  ] as const;

  for (const evidence of amazonEvidence) {
    const storageKey = `demo-samples/evidence/amazon/${evidence.originalName}`;
    const sha256 = createHash("sha256").update(evidence.content).digest("hex");

    await prisma.document.upsert({
      where: { id: evidence.id },
      update: {
        byteSize: evidence.byteSize,
        caseId: amazonCase.id,
        extractedText: evidence.content,
        mimeType: evidence.mimeType,
        originalName: evidence.originalName,
        sha256,
        source: evidence.source,
        sourceReference: evidence.sourceReference,
        status: DocumentStatus.PROCESSED,
        storageKey
      },
      create: {
        id: evidence.id,
        byteSize: evidence.byteSize,
        caseId: amazonCase.id,
        createdAt: caseCreatedAt,
        extractedText: evidence.content,
        mimeType: evidence.mimeType,
        originalName: evidence.originalName,
        sha256,
        source: evidence.source,
        sourceReference: evidence.sourceReference,
        status: DocumentStatus.PROCESSED,
        storageKey
      }
    });
    await prisma.documentEntity.upsert({
      where: { id: `${evidence.id}-entity` },
      update: {
        confidence: 0.96,
        documentId: evidence.id,
        type: evidence.entity.type,
        value: evidence.entity.value
      },
      create: {
        id: `${evidence.id}-entity`,
        confidence: 0.96,
        documentId: evidence.id,
        type: evidence.entity.type,
        value: evidence.entity.value
      }
    });
    await prisma.documentProcessingLog.upsert({
      where: { id: `${evidence.id}-processing` },
      update: {
        documentId: evidence.id,
        message: "Sample evidence extraction and review completed.",
        status: "COMPLETED",
        step: "TEXT_EXTRACTION"
      },
      create: {
        id: `${evidence.id}-processing`,
        documentId: evidence.id,
        message: "Sample evidence extraction and review completed.",
        status: "COMPLETED",
        step: "TEXT_EXTRACTION"
      }
    });

    for (const requirementSortOrder of evidence.requirementSortOrders) {
      await prisma.caseRequirementMatch.upsert({
        where: { id: `${evidence.id}-match-${requirementSortOrder}` },
        update: {
          checklistItemId: `demo-nicholas-amazon-checklist-${requirementSortOrder}`,
          confidence: 0.96,
          documentId: evidence.id,
          rationale: "The processed evidence directly supports this completed requirement.",
          requirementId: `account-ban-${requirementSortOrder}`
        },
        create: {
          id: `${evidence.id}-match-${requirementSortOrder}`,
          checklistItemId: `demo-nicholas-amazon-checklist-${requirementSortOrder}`,
          confidence: 0.96,
          documentId: evidence.id,
          rationale: "The processed evidence directly supports this completed requirement.",
          requirementId: `account-ban-${requirementSortOrder}`
        }
      });
    }

    for (const eventId of evidence.eventIds) {
      await prisma.eventSource.upsert({
        where: { id: `${evidence.id}-${eventId}-source` },
        update: { documentId: evidence.id, eventId },
        create: {
          id: `${evidence.id}-${eventId}-source`,
          documentId: evidence.id,
          eventId
        }
      });
    }
  }

  await prisma.caseStatement.upsert({
    where: { id: demoAmazonStatementId },
    update: { caseId: amazonCase.id, content: amazonStatement },
    create: {
      id: demoAmazonStatementId,
      caseId: amazonCase.id,
      content: amazonStatement,
      createdAt: submittedAt
    }
  });

  const amazonStatementVersions = [amazonStatementDraft, amazonStatement];

  for (const [index, content] of amazonStatementVersions.entries()) {
    const version = index + 1;
    await prisma.statementVersion.upsert({
      where: { id: `demo-nicholas-amazon-statement-v${version}` },
      update: { content, statementId: demoAmazonStatementId, version },
      create: {
        id: `demo-nicholas-amazon-statement-v${version}`,
        content,
        createdAt: addDays(submittedAt, index),
        statementId: demoAmazonStatementId,
        version
      }
    });
  }

  await prisma.statementGuidance.upsert({
    where: { caseId: amazonCase.id },
    update: {
      accountUse: "The account sold original home-office accessories through Northline Studio LLC.",
      actionDate: "The deactivation notice arrived on March 3, 2026.",
      platformAction: "Amazon deactivated the seller account after a fulfillment-rate review.",
      reasonGiven: "Late shipment and valid tracking metrics fell below the required threshold.",
      requestedOutcome: "Restore selling privileges after reviewing the corrective plan and order records.",
      supportContact: "Seller Support acknowledged the plan of action and requested carrier-remediation evidence.",
      supportingDocuments: "Account-health notice, support thread, order report, and seller identity verification."
    },
    create: {
      id: "demo-nicholas-amazon-statement-guidance",
      accountUse: "The account sold original home-office accessories through Northline Studio LLC.",
      actionDate: "The deactivation notice arrived on March 3, 2026.",
      caseId: amazonCase.id,
      platformAction: "Amazon deactivated the seller account after a fulfillment-rate review.",
      reasonGiven: "Late shipment and valid tracking metrics fell below the required threshold.",
      requestedOutcome: "Restore selling privileges after reviewing the corrective plan and order records.",
      supportContact: "Seller Support acknowledged the plan of action and requested carrier-remediation evidence.",
      supportingDocuments: "Account-health notice, support thread, order report, and seller identity verification."
    }
  });

  await prisma.caseSummary.upsert({
    where: { id: "demo-nicholas-amazon-summary-v1" },
    update: { caseId: amazonCase.id, content: amazonSummary },
    create: {
      id: "demo-nicholas-amazon-summary-v1",
      caseId: amazonCase.id,
      content: amazonSummary,
      createdAt: resolvedAt
    }
  });

  const amazonSubmission = await prisma.caseSubmission.upsert({
    where: { id: "demo-nicholas-amazon-submission-round-1" },
    update: {
      caseId: amazonCase.id,
      channel: AppealSubmissionChannel.WEB_PORTAL,
      confirmationCode: "AMZ-SP-88421",
      destination: "Amazon Seller Performance",
      notes: "Submitted the corrective plan with order, carrier, and ownership records.",
      resolvedAt,
      responseDueAt: new Date("2026-03-25T17:00:00.000Z"),
      round: 1,
      status: AppealSubmissionStatus.APPROVED,
      submittedAt
    },
    create: {
      id: "demo-nicholas-amazon-submission-round-1",
      caseId: amazonCase.id,
      channel: AppealSubmissionChannel.WEB_PORTAL,
      confirmationCode: "AMZ-SP-88421",
      createdAt: submittedAt,
      destination: "Amazon Seller Performance",
      notes: "Submitted the corrective plan with order, carrier, and ownership records.",
      resolvedAt,
      responseDueAt: new Date("2026-03-25T17:00:00.000Z"),
      round: 1,
      status: AppealSubmissionStatus.APPROVED,
      submittedAt
    }
  });

  const amazonSubmissionUpdates = [
    {
      id: "demo-nicholas-amazon-submission-update-submitted",
      details: "Submitted the plan of action and supporting records through Seller Central.",
      occurredAt: submittedAt,
      status: AppealSubmissionStatus.SUBMITTED,
      title: "Reinstatement appeal submitted",
      type: SubmissionUpdateType.STATUS_CHANGE
    },
    {
      id: "demo-nicholas-amazon-submission-update-review",
      details: "Seller Performance confirmed receipt and began reviewing the corrective plan.",
      occurredAt: new Date("2026-03-12T15:15:00.000Z"),
      status: AppealSubmissionStatus.UNDER_REVIEW,
      title: "Appeal moved to review",
      type: SubmissionUpdateType.ACKNOWLEDGEMENT
    },
    {
      id: "demo-nicholas-amazon-submission-update-approved",
      details: "Amazon approved the plan of action and restored selling privileges.",
      occurredAt: resolvedAt,
      status: AppealSubmissionStatus.APPROVED,
      title: "Seller account reinstated",
      type: SubmissionUpdateType.DECISION
    }
  ];

  for (const update of amazonSubmissionUpdates) {
    await prisma.submissionUpdate.upsert({
      where: { id: update.id },
      update: { ...update, submissionId: amazonSubmission.id },
      create: { ...update, submissionId: amazonSubmission.id }
    });
  }

  const amazonPacketCreatedAt = new Date("2026-03-10T19:00:00.000Z");
  const amazonPacket = await prisma.casePacket.upsert({
    where: { id: "demo-nicholas-amazon-packet" },
    update: {
      caseId: amazonCase.id,
      createdAt: amazonPacketCreatedAt,
      status: PacketStatus.READY
    },
    create: {
      id: "demo-nicholas-amazon-packet",
      caseId: amazonCase.id,
      createdAt: amazonPacketCreatedAt,
      status: PacketStatus.READY
    }
  });

  await prisma.packetExport.upsert({
    where: { id: "demo-nicholas-amazon-packet-export" },
    update: {
      byteSize: 9_785,
      createdAt: amazonPacketCreatedAt,
      includedDocumentCount: 4,
      indexedDocumentCount: 4,
      packetId: amazonPacket.id,
      pageCount: 5,
      storageKey: "demo-samples/packets/amazon-seller-reinstatement-appeal.pdf"
    },
    create: {
      id: "demo-nicholas-amazon-packet-export",
      byteSize: 9_785,
      createdAt: amazonPacketCreatedAt,
      includedDocumentCount: 4,
      indexedDocumentCount: 4,
      packetId: amazonPacket.id,
      pageCount: 5,
      storageKey: "demo-samples/packets/amazon-seller-reinstatement-appeal.pdf"
    }
  });

  await prisma.notification.upsert({
    where: { id: "demo-nicholas-notification-amazon-resolved" },
    update: {
      body: "Amazon approved the corrective plan and restored selling privileges.",
      caseId: amazonCase.id,
      createdAt: resolvedAt,
      inAppVisible: true,
      readAt: addDays(resolvedAt, 1),
      title: "Amazon seller account reinstated",
      type: "case_resolved",
      userId: input.userId
    },
    create: {
      id: "demo-nicholas-notification-amazon-resolved",
      body: "Amazon approved the corrective plan and restored selling privileges.",
      caseId: amazonCase.id,
      createdAt: resolvedAt,
      inAppVisible: true,
      readAt: addDays(resolvedAt, 1),
      title: "Amazon seller account reinstated",
      type: "case_resolved",
      userId: input.userId
    }
  });

  const amazonAuditLogs = [
    {
      id: "demo-nicholas-amazon-audit-created",
      action: "case.created",
      createdAt: caseCreatedAt,
      metadata: { platform: "Amazon", title: amazonCase.title }
    },
    {
      id: "demo-nicholas-amazon-audit-packet",
      action: "case.packet_generated",
      createdAt: amazonPacketCreatedAt,
      metadata: {
        includedDocumentCount: 4,
        indexedDocumentCount: 4,
        packetId: amazonPacket.id,
        pageCount: 5
      }
    },
    {
      id: "demo-nicholas-amazon-audit-submitted",
      action: "case.submission_created",
      createdAt: submittedAt,
      metadata: {
        channel: AppealSubmissionChannel.WEB_PORTAL,
        round: 1,
        submissionId: amazonSubmission.id
      }
    },
    {
      id: "demo-nicholas-amazon-audit-resolved",
      action: "case.submission_updated",
      createdAt: resolvedAt,
      metadata: {
        status: AppealSubmissionStatus.APPROVED,
        submissionId: amazonSubmission.id,
        title: "Seller account reinstated"
      }
    }
  ];

  for (const log of amazonAuditLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {
        action: log.action,
        caseId: amazonCase.id,
        createdAt: log.createdAt,
        metadata: log.metadata,
        userId: input.userId
      },
      create: {
        ...log,
        caseId: amazonCase.id,
        userId: input.userId
      }
    });
  }
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMinutes(value: Date, minutes: number) {
  const nextDate = new Date(value);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}

function addMonths(value: Date, months: number) {
  const nextDate = new Date(value);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate;
}

function createInvoiceNumber(value: Date) {
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `PP-${value.getUTCFullYear()}${month}-001`;
}

function getBillingPeriodStart(value: Date, billingDay: number) {
  const periodStart = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), billingDay, 12)
  );

  if (value.getUTCDate() < billingDay) {
    periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
  }

  return periodStart;
}

function getDemoChecklistStatus(sortOrder: number) {
  if (sortOrder === 3 || sortOrder === 6) {
    return ChecklistStatus.COMPLETE;
  }

  if (sortOrder === 2 || sortOrder === 5) {
    return ChecklistStatus.NEEDS_REVIEW;
  }

  return ChecklistStatus.MISSING;
}

main()
  .then(async () => {
    await closePrismaClient();
  })
  .catch(async (error) => {
    console.error(error);
    await closePrismaClient();
    process.exit(1);
  });
