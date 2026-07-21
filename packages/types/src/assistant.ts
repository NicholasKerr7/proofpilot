import { z } from "zod";
import { sanitizeUserText } from "./text.js";

export const assistantMessageRoles = ["USER", "ASSISTANT"] as const;
export const assistantResponseModes = ["GUIDED", "MODEL"] as const;
export const assistantActionDestinations = [
  "case-overview",
  "evidence-intake",
  "case-timeline",
  "evidence-checklist",
  "statement-builder",
  "packet-export"
] as const;

export const createAssistantMessageSchema = z.object({
  content: z
    .string()
    .transform((value) => sanitizeUserText(value))
    .pipe(z.string().min(2).max(2000))
});

export type AssistantMessageRole = (typeof assistantMessageRoles)[number];
export type AssistantResponseMode = (typeof assistantResponseModes)[number];
export type AssistantActionDestination = (typeof assistantActionDestinations)[number];
export type CreateAssistantMessageInput = z.infer<typeof createAssistantMessageSchema>;

export interface AssistantCapability {
  model: string | null;
  modelGeneration: boolean;
  responseMode: AssistantResponseMode;
}

export interface AssistantCaseSummary {
  checklistReady: number;
  checklistTotal: number;
  createdAt: string;
  deadline: string | null;
  documentCount: number;
  eventCount: number;
  id: string;
  platform: string;
  progress: number;
  statementCount: number;
  status: string;
  summary: string | null;
  title: string;
}

export interface AssistantMessage {
  content: string;
  createdAt: string;
  id: string;
  model: string | null;
  responseMode: AssistantResponseMode | null;
  role: AssistantMessageRole;
}

export interface AssistantAction {
  destinationId: AssistantActionDestination;
  detail: string;
  label: string;
  status: string;
}

export interface AssistantWorkspace {
  capability: AssistantCapability;
  case: AssistantCaseSummary;
  messages: AssistantMessage[];
  nextActions: AssistantAction[];
  suggestedPrompts: string[];
  threadId: string | null;
}

export interface AssistantExchange {
  assistantMessage: AssistantMessage;
  threadId: string;
  userMessage: AssistantMessage;
}
