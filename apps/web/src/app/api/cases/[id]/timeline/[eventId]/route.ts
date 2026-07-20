import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface TimelineEventRouteContext {
  params: Promise<{
    eventId: string;
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: TimelineEventRouteContext) {
  const { eventId, id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/timeline/${eventId}`, {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}

export async function DELETE(_request: NextRequest, context: TimelineEventRouteContext) {
  const { eventId, id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/timeline/${eventId}`, {
    method: "DELETE"
  });
}
