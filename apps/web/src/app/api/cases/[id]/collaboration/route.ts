import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface CaseCollaborationRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: CaseCollaborationRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/collaboration`);
}
