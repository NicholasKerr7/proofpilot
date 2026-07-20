import { config } from "dotenv";
import {
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
  InvoiceStatus,
  SubscriptionStatus,
  closePrismaClient,
  getPrismaClient
} from "../src/index.js";

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
const demoCaseSummary =
  "PayPal limited the account after a payment review. The saved timeline covers the restriction notice, support contact, and appeal preparation. Current evidence includes the limitation notice and account records, with ownership proof still being gathered. Nicholas is requesting restored access or a specific explanation of any remaining requirements.";

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

  const statementContent =
    "I am requesting a review of my PayPal account limitation. The account was used for legitimate payments and routine business activity. I am collecting the limitation notice, support correspondence, ownership proof, and transaction context so PayPal can verify the account activity and restore access or explain the remaining requirements.";

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
      content: statementContent,
      statementId: demoStatementId,
      version: 1
    },
    create: {
      id: "demo-nicholas-paypal-statement-v1",
      content: statementContent,
      statementId: demoStatementId,
      version: 1
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

  await prisma.notification.upsert({
    where: { id: "demo-nicholas-notification-welcome" },
    update: {
      body: "A PayPal appeal case is ready for evidence review.",
      caseId: demoCase.id,
      readAt: null,
      title: "Demo case ready",
      type: "demo_case_ready",
      userId: user.id
    },
    create: {
      id: "demo-nicholas-notification-welcome",
      body: "A PayPal appeal case is ready for evidence review.",
      caseId: demoCase.id,
      title: "Demo case ready",
      type: "demo_case_ready",
      userId: user.id
    }
  });

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
      metadata: { statementId: demoStatementId, version: 1 }
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

  if (sortOrder === 2) {
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
