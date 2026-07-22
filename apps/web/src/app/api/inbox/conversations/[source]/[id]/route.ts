import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface InboxConversationRouteContext {
  params: Promise<{
    id: string;
    source: string;
  }>;
}

export async function GET(_request: Request, context: InboxConversationRouteContext) {
  const { id, source } = await context.params;
  return proxyToProofPilotApi(`/inbox/conversations/${source}/${id}`);
}
