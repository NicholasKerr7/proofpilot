import {
  CaseStatus,
  ChecklistStatus,
  closePrismaClient,
  getPrismaClient
} from "../src/index.js";

const prisma = getPrismaClient();
const demoUser = {
  email: "nicholas.kerr@proofpilot.test",
  name: "Nicholas Kerr",
  passwordHash: "$2b$12$X2xny4j4VEX.7qkHfRntBeF3JgkZ9BT3ydepVYXyAoAsnBi2D4vNO"
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
      passwordHash: demoUser.passwordHash
    },
    create: demoUser
  });

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
      summary:
        "PayPal limited the account after a payment review. The appeal packet needs the restriction notice, support messages, ownership proof, and a concise written explanation.",
      title: "PayPal account closure appeal"
    },
    create: {
      id: demoCaseId,
      caseTypeId: caseType.id,
      deadline,
      ownerId: user.id,
      platform: "PayPal",
      status: CaseStatus.NEEDS_MORE_EVIDENCE,
      summary:
        "PayPal limited the account after a payment review. The appeal packet needs the restriction notice, support messages, ownership proof, and a concise written explanation.",
      title: "PayPal account closure appeal"
    }
  });

  for (const requirement of requirements) {
    await prisma.caseChecklistItem.upsert({
      where: { id: `demo-nicholas-checklist-${requirement.sortOrder}` },
      update: {
        caseId: demoCase.id,
        description: requirement.description,
        label: requirement.label,
        requirementId: `account-ban-${requirement.sortOrder}`,
        status: getDemoChecklistStatus(requirement.sortOrder)
      },
      create: {
        id: `demo-nicholas-checklist-${requirement.sortOrder}`,
        caseId: demoCase.id,
        description: requirement.description,
        label: requirement.label,
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

  for (const event of demoEvents) {
    await prisma.caseEvent.upsert({
      where: { id: event.id },
      update: {
        caseId: demoCase.id,
        description: event.description,
        occurredAt: event.occurredAt,
        title: event.title
      },
      create: {
        id: event.id,
        caseId: demoCase.id,
        confidence: null,
        description: event.description,
        occurredAt: event.occurredAt,
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

  await prisma.reminder.upsert({
    where: { id: "demo-nicholas-reminder-review" },
    update: {
      caseId: demoCase.id,
      message: "Review missing evidence before the PayPal appeal deadline.",
      remindAt: reminderDate,
      sentAt: null
    },
    create: {
      id: "demo-nicholas-reminder-review",
      caseId: demoCase.id,
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
