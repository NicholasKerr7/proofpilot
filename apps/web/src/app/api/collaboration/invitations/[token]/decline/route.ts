import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface CollaborationInvitationDeclineRouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(
  _request: Request,
  context: CollaborationInvitationDeclineRouteContext
) {
  const { token } = await context.params;
  return proxyToProofPilotApi(
    `/collaboration/invitations/${encodeURIComponent(token)}/decline`,
    { method: "POST" }
  );
}
