import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface CollaborationInvitationAcceptRouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(
  _request: Request,
  context: CollaborationInvitationAcceptRouteContext
) {
  const { token } = await context.params;
  return proxyToProofPilotApi(
    `/collaboration/invitations/${encodeURIComponent(token)}/accept`,
    { method: "POST" }
  );
}
