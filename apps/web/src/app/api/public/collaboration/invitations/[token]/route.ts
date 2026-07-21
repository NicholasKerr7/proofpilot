import { proxyToPublicProofPilotApi } from "@/lib/server/proofpilot-api";

interface PublicCollaborationInvitationRouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(
  _request: Request,
  context: PublicCollaborationInvitationRouteContext
) {
  const { token } = await context.params;
  return proxyToPublicProofPilotApi(
    `/collaboration/invitations/${encodeURIComponent(token)}`
  );
}
