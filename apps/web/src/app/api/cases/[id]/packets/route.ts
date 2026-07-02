import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface CasePacketsRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: CasePacketsRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/packets`);
}
