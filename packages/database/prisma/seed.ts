import { getPrismaClient } from "../src/index.js";

const prisma = getPrismaClient();

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
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
