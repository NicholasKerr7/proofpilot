import type { HelpArticleSlug } from "@proofpilot/types";

export type HelpCategoryId =
  | "getting-started"
  | "cases-evidence"
  | "timeline-checklist"
  | "statements-packets"
  | "submission-review"
  | "account-security";

export interface HelpCategory {
  id: HelpCategoryId;
  title: string;
  description: string;
}

export interface HelpArticleStep {
  title: string;
  detail: string;
}

export interface HelpArticleSection {
  heading: string;
  paragraphs?: string[];
  steps?: HelpArticleStep[];
}

export interface HelpArticle {
  slug: HelpArticleSlug;
  categoryId: HelpCategoryId;
  title: string;
  summary: string;
  intro: string;
  updatedAt: string;
  readMinutes: number;
  sections: HelpArticleSection[];
  tip?: string;
  related: HelpArticleSlug[];
  popular?: boolean;
}

export const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Set up your workspace and first case."
  },
  {
    id: "cases-evidence",
    title: "Cases & evidence",
    description: "Upload and organize appeal evidence."
  },
  {
    id: "timeline-checklist",
    title: "Timeline & checklist",
    description: "Review dates and close evidence gaps."
  },
  {
    id: "statements-packets",
    title: "Statements & packets",
    description: "Draft statements and produce PDF packets."
  },
  {
    id: "submission-review",
    title: "Submission & review",
    description: "Prepare submissions and track responses."
  },
  {
    id: "account-security",
    title: "Security & privacy",
    description: "Protect access and private case data."
  }
];

export const helpArticles: HelpArticle[] = [
  {
    slug: "getting-started",
    categoryId: "getting-started",
    title: "Start building with ProofPilot",
    summary: "Understand the complete appeal-packet workflow before creating a case.",
    intro:
      "ProofPilot turns scattered records into an organized appeal packet. Each workspace keeps the case, evidence, timeline, checklist, statement, and packet together.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "The core workflow",
        steps: [
          { title: "Create a case", detail: "Name the appeal, identify the platform, and add any known deadline." },
          { title: "Collect evidence", detail: "Upload notices, support conversations, ownership proof, and transaction context." },
          { title: "Review the analysis", detail: "Confirm extracted timeline events and resolve checklist gaps." },
          { title: "Prepare the packet", detail: "Write the statement, preview the case, and generate the PDF." }
        ]
      }
    ],
    tip: "Start with the platform notice and account-ownership proof. Those files usually provide the clearest case context.",
    related: ["create-first-case", "upload-evidence"]
  },
  {
    slug: "create-first-case",
    categoryId: "getting-started",
    title: "Create your first appeal case",
    summary: "Set up a focused case with the right platform, deadline, and summary.",
    intro:
      "A case is the private workspace for one appeal or account restriction. Keep unrelated disputes in separate cases so each packet stays clear.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "Create the case",
        steps: [
          { title: "Open Cases", detail: "Choose Create case from the Cases screen or the More menu." },
          { title: "Use a specific title", detail: "Include the platform and the action being appealed." },
          { title: "Add the deadline", detail: "Use the date from the notice when one is provided." },
          { title: "Summarize the issue", detail: "Record the account action, what you know, and the result you are requesting." }
        ]
      }
    ],
    tip: "Do not include passwords, full payment-card numbers, or security codes in a case summary.",
    related: ["getting-started", "upload-evidence"]
  },
  {
    slug: "upload-evidence",
    categoryId: "cases-evidence",
    title: "How do I upload evidence?",
    summary: "Add documents, images, email exports, and structured data to a case.",
    intro:
      "Evidence uploads are stored in the selected case and queued for processing. ProofPilot can then extract useful text and dates for review.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "Upload evidence",
        steps: [
          { title: "Select the case", detail: "Open Upload and confirm the destination case before choosing files." },
          { title: "Choose the source", detail: "Pick files from your device or use the available camera capture flow." },
          { title: "Review the queue", detail: "Confirm file names and remove anything that belongs to another case." },
          { title: "Start the upload", detail: "Keep the page open while files transfer and processing begins." },
          { title: "Check processing", detail: "Review extracted text and retry any file marked failed or needs review." }
        ]
      }
    ],
    tip: "On larger screens, you can drag supported files into the import area.",
    related: ["supported-file-types", "organize-evidence"],
    popular: true
  },
  {
    slug: "supported-file-types",
    categoryId: "cases-evidence",
    title: "What file types are supported?",
    summary: "Review the document, image, email, and spreadsheet formats accepted by the uploader.",
    intro:
      "ProofPilot accepts the common records used in account appeals while keeping unsupported files out of the processing queue.",
    updatedAt: "2026-07-11",
    readMinutes: 2,
    sections: [
      {
        heading: "Accepted formats",
        paragraphs: [
          "Documents: PDF, TXT, and DOCX.",
          "Images: PNG, JPG, and JPEG.",
          "Messages and data: EML email exports, CSV, and XLSX spreadsheets."
        ]
      },
      {
        heading: "Before uploading",
        paragraphs: [
          "Open the file first to make sure it is readable, complete, and belongs to the selected case. Export password-protected documents without encryption before uploading."
        ]
      }
    ],
    related: ["upload-evidence", "organize-evidence"]
  },
  {
    slug: "organize-evidence",
    categoryId: "cases-evidence",
    title: "How should I organize my evidence?",
    summary: "Keep the strongest records easy to review and connect to the case chronology.",
    intro:
      "A smaller set of relevant, readable files is more useful than a large folder of duplicates and unrelated screenshots.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "Evidence review checklist",
        steps: [
          { title: "Keep original context", detail: "Include dates, sender names, ticket IDs, and visible platform details." },
          { title: "Remove duplicates", detail: "Keep the clearest version of repeated screenshots or exports." },
          { title: "Use readable files", detail: "Avoid heavily cropped, blurred, or incomplete records." },
          { title: "Review extracted text", detail: "Correct the case chronology when automated extraction needs clarification." }
        ]
      }
    ],
    related: ["upload-evidence", "evidence-checklist"]
  },
  {
    slug: "timeline-basics",
    categoryId: "timeline-checklist",
    title: "How does the timeline work?",
    summary: "Build a clear chronology from notices, support contacts, appeals, and deadlines.",
    intro:
      "The timeline helps a reviewer understand what happened and in what order. ProofPilot can suggest events from processed evidence, but you remain responsible for confirming them.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "Review timeline events",
        steps: [
          { title: "Analyze processed evidence", detail: "Run timeline analysis after the relevant files finish processing." },
          { title: "Confirm each date", detail: "Compare suggested dates with the original notice or conversation." },
          { title: "Add missing context", detail: "Record important calls, submissions, or deadlines that are not in an uploaded file." },
          { title: "Keep entries factual", detail: "Describe the event without speculation or emotional language." }
        ]
      }
    ],
    related: ["evidence-checklist", "prepare-final-packet"],
    popular: true
  },
  {
    slug: "evidence-checklist",
    categoryId: "timeline-checklist",
    title: "How do I resolve checklist gaps?",
    summary: "Understand found, missing, optional, and needs-review evidence requirements.",
    intro:
      "The checklist compares processed evidence with the standard appeal template. It is a review aid, not a guarantee that a platform will accept the packet.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "Work through requirements",
        steps: [
          { title: "Run evidence analysis", detail: "Analyze the checklist after uploading the files you currently have." },
          { title: "Open missing items", detail: "Read the requirement description before collecting another file." },
          { title: "Review suggested matches", detail: "Make sure the matched document actually supports the requirement." },
          { title: "Reanalyze after changes", detail: "Run the check again after new evidence finishes processing." }
        ]
      }
    ],
    related: ["organize-evidence", "prepare-final-packet"]
  },
  {
    slug: "build-appeal-statement",
    categoryId: "statements-packets",
    title: "How do I write a strong appeal statement?",
    summary: "Create a concise, factual explanation grounded in the evidence and timeline.",
    intro:
      "A strong statement explains the account action, the relevant facts, the supporting records, and the outcome you are requesting.",
    updatedAt: "2026-07-11",
    readMinutes: 4,
    sections: [
      {
        heading: "Build the statement",
        steps: [
          { title: "State the request", detail: "Open with the review or reinstatement you are asking the platform to consider." },
          { title: "Explain the facts", detail: "Use the confirmed timeline and avoid claims the evidence cannot support." },
          { title: "Point to key evidence", detail: "Mention the records that verify ownership, activity, and support history." },
          { title: "Review the generated draft", detail: "Treat generated text as a draft and correct every inaccurate detail." },
          { title: "Save a final version", detail: "Read the statement once more before generating the packet." }
        ]
      }
    ],
    tip: "Clear and factual language is usually more persuasive than an emotional or accusatory tone.",
    related: ["prepare-final-packet", "generate-case-packet"],
    popular: true
  },
  {
    slug: "generate-case-packet",
    categoryId: "statements-packets",
    title: "How do I generate a case packet?",
    summary: "Create the private PDF after reviewing case readiness and packet sections.",
    intro:
      "Packet generation assembles the current case summary, statement, timeline, checklist, evidence index, and supporting records into a PDF.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "Generate and download",
        steps: [
          { title: "Review readiness", detail: "Resolve material evidence gaps and confirm the statement first." },
          { title: "Generate the packet", detail: "Open Packet export and start PDF generation." },
          { title: "Wait for processing", detail: "The packet moves through the background queue before it is ready." },
          { title: "Preview and download", detail: "Review the generated version, then use its private download link." }
        ]
      }
    ],
    related: ["prepare-final-packet", "review-process"],
    popular: true
  },
  {
    slug: "prepare-final-packet",
    categoryId: "statements-packets",
    title: "How to prepare your final appeal packet",
    summary: "Complete a final accuracy, evidence, and deadline review before submission.",
    intro:
      "A final review catches missing pages, unsupported claims, and date errors before the packet leaves your private workspace.",
    updatedAt: "2026-07-11",
    readMinutes: 5,
    sections: [
      {
        heading: "Final review",
        steps: [
          { title: "Review the case", detail: "Confirm the platform, account action, requested outcome, and deadline." },
          { title: "Complete required sections", detail: "Check the timeline, evidence checklist, and statement for unresolved gaps." },
          { title: "Verify supporting evidence", detail: "Make sure each included record is relevant, readable, and correctly described." },
          { title: "Preview the PDF", detail: "Check page order, names, dates, and any extracted content before downloading." },
          { title: "Submit through the platform", detail: "ProofPilot prepares the packet; you submit it through the platform's official appeal channel." }
        ]
      }
    ],
    tip: "Keep the downloaded packet and the platform submission confirmation together for your records.",
    related: ["generate-case-packet", "review-process"]
  },
  {
    slug: "review-process",
    categoryId: "submission-review",
    title: "What happens after I submit my appeal?",
    summary: "Track confirmation details and keep the case ready for follow-up requests.",
    intro:
      "Review timelines and requirements are controlled by the platform receiving the appeal. ProofPilot does not submit or decide appeals.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "After submission",
        steps: [
          { title: "Save confirmation", detail: "Keep the ticket number, confirmation email, and submission date as evidence." },
          { title: "Record the event", detail: "Add the submission to the case timeline and update the case status." },
          { title: "Monitor official channels", detail: "Watch the platform account and verified email address for requests." },
          { title: "Add new responses", detail: "Upload platform replies and update the packet if a follow-up is required." }
        ]
      }
    ],
    related: ["prepare-final-packet", "timeline-basics"]
  },
  {
    slug: "security-and-privacy",
    categoryId: "account-security",
    title: "Is my case information secure?",
    summary: "Learn how account access, ownership checks, and private file links protect case data.",
    intro:
      "ProofPilot treats case records and evidence as private user-owned resources. Access is checked before protected API operations and file downloads use expiring signed links.",
    updatedAt: "2026-07-11",
    readMinutes: 3,
    sections: [
      {
        heading: "Protect your workspace",
        steps: [
          { title: "Use a unique password", detail: "Do not reuse the password from the platform involved in the appeal." },
          { title: "Review files before upload", detail: "Remove unrelated secrets and unnecessary personal information." },
          { title: "Sign out on shared devices", detail: "Close the session when another person can access the browser." },
          { title: "Control downloaded packets", detail: "Store exported PDFs securely because downloaded copies are outside ProofPilot." }
        ]
      }
    ],
    related: ["getting-started", "supported-file-types"],
    popular: true
  }
];

export const helpArticlesBySlug = new Map(
  helpArticles.map((article) => [article.slug, article] as const)
);

export const helpCategoriesById = new Map(
  helpCategories.map((category) => [category.id, category] as const)
);
