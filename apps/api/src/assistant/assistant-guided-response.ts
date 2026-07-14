import type { AssistantCaseContext } from "./assistant-case-context.js";
import {
  getAssistantNextActions,
  getAssistantProgress,
  isAssistantChecklistReady
} from "./assistant-case-context.js";

export type AssistantGuidedIntent =
  | "EVIDENCE"
  | "SUMMARY"
  | "STATEMENT"
  | "NEXT_STEP"
  | "TIMELINE"
  | "ACCOUNT_SECURITY"
  | "GENERAL";

export interface AssistantGuidedResponse {
  content: string;
  intent: AssistantGuidedIntent;
}

export function createGuidedAssistantResponse(
  caseRecord: AssistantCaseContext,
  prompt: string
): AssistantGuidedResponse {
  const intent = classifyPrompt(prompt);

  switch (intent) {
    case "EVIDENCE":
      return { content: createEvidenceResponse(caseRecord), intent };
    case "SUMMARY":
      return { content: createSummaryResponse(caseRecord), intent };
    case "STATEMENT":
      return { content: createStatementResponse(caseRecord), intent };
    case "NEXT_STEP":
      return { content: createNextStepResponse(caseRecord), intent };
    case "TIMELINE":
      return { content: createTimelineResponse(caseRecord), intent };
    case "ACCOUNT_SECURITY":
      return { content: createAccountSecurityResponse(caseRecord), intent };
    default:
      return { content: createGeneralResponse(caseRecord), intent };
  }
}

function classifyPrompt(prompt: string): AssistantGuidedIntent {
  const normalized = prompt.toLowerCase();

  if (includesAny(normalized, ["evidence", "missing", "document", "proof", "gap"])) {
    return "EVIDENCE";
  }
  if (includesAny(normalized, ["summary", "summarize", "overview", "case status"])) {
    return "SUMMARY";
  }
  if (includesAny(normalized, ["statement", "draft", "rewrite", "opening", "clarity"])) {
    return "STATEMENT";
  }
  if (includesAny(normalized, ["next", "priority", "first", "what should i do"])) {
    return "NEXT_STEP";
  }
  if (includesAny(normalized, ["timeline", "date", "event", "chronology"])) {
    return "TIMELINE";
  }
  if (includesAny(normalized, ["security", "password", "account access", "login"])) {
    return "ACCOUNT_SECURITY";
  }

  return "GENERAL";
}

function createEvidenceResponse(caseRecord: AssistantCaseContext) {
  const missingItems = caseRecord.checklist.filter(
    (item) => !isAssistantChecklistReady(item.status)
  );
  const lines = [
    `Your ${caseRecord.platform} case has ${missingItems.length} checklist ${missingItems.length === 1 ? "item" : "items"} that are not ready.`
  ];

  if (missingItems.length) {
    lines.push("", ...missingItems.slice(0, 5).map((item) => `- ${item.label}`));
  } else {
    lines.push("", "Every checklist item currently has a ready match. Review each match before export.");
  }

  lines.push(
    "",
    caseRecord._count.documents
      ? `${caseRecord._count.documents} evidence ${caseRecord._count.documents === 1 ? "file is" : "files are"} saved. Add files only when they directly support an unresolved requirement.`
      : "No evidence files are saved yet. Start with the restriction notice, support correspondence, and account ownership proof.",
    "",
    "No case records were changed. Open Evidence or Checklist to act on these gaps."
  );

  return lines.join("\n");
}

function createSummaryResponse(caseRecord: AssistantCaseContext) {
  const progress = getAssistantProgress(caseRecord);
  const summary = caseRecord.summary?.trim() || "No case summary has been saved yet.";

  return [
    `${caseRecord.title}`,
    "",
    summary,
    "",
    `- Status: ${formatStatus(caseRecord.status)}`,
    `- Readiness: ${progress}%`,
    `- Evidence files: ${caseRecord._count.documents}`,
    `- Timeline events: ${caseRecord._count.events}`,
    `- Checklist ready: ${caseRecord.checklist.filter((item) => isAssistantChecklistReady(item.status)).length} of ${caseRecord.checklist.length}`,
    `- Statement drafts: ${caseRecord._count.statements}`
  ].join("\n");
}

function createStatementResponse(caseRecord: AssistantCaseContext) {
  const currentStatement = caseRecord.statements[0];
  const missingItems = caseRecord.checklist.filter(
    (item) => !isAssistantChecklistReady(item.status)
  );
  const lines = [
    currentStatement
      ? "A statement draft is saved. Based on the current case record, strengthen it by:"
      : "No statement draft is saved yet. Build the first draft around these points:",
    "",
    `- State the ${caseRecord.platform} account action and the review you are requesting.`,
    caseRecord._count.events
      ? `- Anchor the explanation to the ${caseRecord._count.events} saved timeline events.`
      : "- Add the notice date and support-contact dates before describing the sequence.",
    caseRecord.documents.length
      ? `- Name the strongest saved evidence instead of referring generally to documents.`
      : "- Avoid claiming supporting proof until the evidence files are uploaded.",
    missingItems.length
      ? `- Address unresolved proof directly, especially ${missingItems.slice(0, 2).map((item) => item.label).join(" and ")}.`
      : "- Confirm that every factual claim is supported by a checklist match.",
    "- End with a specific requested outcome.",
    "",
    "Nothing was rewritten automatically. Open Statement to review or edit the draft."
  ];

  return lines.join("\n");
}

function createNextStepResponse(caseRecord: AssistantCaseContext) {
  const actions = getAssistantNextActions(caseRecord);
  const firstAction = actions[0];

  return [
    `Start with: ${firstAction?.label ?? "Review the case"}.`,
    firstAction?.detail ?? "Review the saved case before making changes.",
    "",
    "Then work through:",
    ...actions.slice(1).map((action) => `- ${action.label}: ${action.status}`),
    "",
    "These priorities come from the records currently saved in this case."
  ].join("\n");
}

function createTimelineResponse(caseRecord: AssistantCaseContext) {
  if (!caseRecord.events.length) {
    return "The timeline is empty. Add the account-action notice date, each support contact, any prior appeal, and the current deadline. Keep descriptions factual and link supporting evidence where possible.";
  }

  return [
    `The timeline contains ${caseRecord._count.events} events:`,
    "",
    ...caseRecord.events.slice(0, 6).map(
      (event) => `- ${formatDate(event.occurredAt)}: ${event.title}`
    ),
    ...(caseRecord._count.events > 6
      ? ["", `Showing the first 6 of ${caseRecord._count.events} events.`]
      : []),
    "",
    "Check that the sequence is complete and that dates match the underlying notices or messages."
  ].join("\n");
}

function createAccountSecurityResponse(caseRecord: AssistantCaseContext) {
  return [
    `For the ${caseRecord.platform} appeal, describe security steps only when they are accurate and relevant.`,
    "",
    "Useful records can include:",
    "- Password or recovery changes completed after the account action",
    "- Devices or sessions you reviewed",
    "- Two-factor authentication enabled with the platform",
    "- Support instructions you followed",
    "",
    "Do not include passwords, recovery codes, full payment numbers, or identity-document numbers in the statement."
  ].join("\n");
}

function createGeneralResponse(caseRecord: AssistantCaseContext) {
  return [
    `I can interpret the records saved for "${caseRecord.title}" in guided mode.`,
    "",
    "Try asking me to:",
    "- Identify missing evidence",
    "- Summarize the case",
    "- Review statement structure",
    "- Prioritize the next step",
    "- Check the timeline",
    "",
    "No external model is configured, so this response was built from deterministic case rules and did not send case data to an AI provider."
  ].join("\n");
}

function includesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(value);
}
