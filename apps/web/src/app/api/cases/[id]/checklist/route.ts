import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface ChecklistRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: ChecklistRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/checklist`);
}
