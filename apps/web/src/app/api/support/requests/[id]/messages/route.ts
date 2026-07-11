import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface SupportRequestMessagesRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, context: SupportRequestMessagesRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/support/requests/${id}/messages`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
