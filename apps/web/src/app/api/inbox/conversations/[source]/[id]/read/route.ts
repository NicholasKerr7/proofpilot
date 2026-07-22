import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface InboxConversationReadRouteContext {
  params: Promise<{
    id: string;
    source: string;
  }>;
}

export async function PATCH(
  request: NextRequest,
  context: InboxConversationReadRouteContext
) {
  const { id, source } = await context.params;
  return proxyToProofPilotApi(`/inbox/conversations/${source}/${id}/read`, {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}
