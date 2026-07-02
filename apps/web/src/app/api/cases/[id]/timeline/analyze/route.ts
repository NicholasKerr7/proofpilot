import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface AnalyzeTimelineRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: AnalyzeTimelineRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/timeline/analyze`, {
    method: "POST"
  });
}
