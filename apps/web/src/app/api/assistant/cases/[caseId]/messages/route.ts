import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface AssistantMessagesRouteContext {
  params: Promise<{
    caseId: string;
  }>;
}

export async function POST(request: NextRequest, context: AssistantMessagesRouteContext) {
  const { caseId } = await context.params;
  return proxyToProofPilotApi(`/assistant/cases/${caseId}/messages`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
