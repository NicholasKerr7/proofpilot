import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface AnalyzeChecklistRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: AnalyzeChecklistRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/checklist/analyze`, {
    method: "POST"
  });
}
