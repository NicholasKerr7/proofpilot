import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface GenerateCaseSummaryRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: GenerateCaseSummaryRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/summary/generate`, {
    method: "POST"
  });
}
