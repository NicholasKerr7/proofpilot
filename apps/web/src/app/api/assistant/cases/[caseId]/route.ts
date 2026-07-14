import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface AssistantCaseRouteContext {
  params: Promise<{
    caseId: string;
  }>;
}

export async function GET(_request: NextRequest, context: AssistantCaseRouteContext) {
  const { caseId } = await context.params;
  return proxyToProofPilotApi(`/assistant/cases/${caseId}`);
}
