import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseCollaborationInvitationsRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: CaseCollaborationInvitationsRouteContext
) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/collaboration/invitations`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
