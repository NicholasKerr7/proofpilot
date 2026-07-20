import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface RestoreStatementVersionRouteContext {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
}

export async function POST(_request: NextRequest, context: RestoreStatementVersionRouteContext) {
  const { id, versionId } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/statement/versions/${versionId}/restore`, {
    method: "POST"
  });
}
