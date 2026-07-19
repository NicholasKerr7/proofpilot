import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseCollaborationSettingsRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  context: CaseCollaborationSettingsRouteContext
) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/collaboration/settings`, {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}
