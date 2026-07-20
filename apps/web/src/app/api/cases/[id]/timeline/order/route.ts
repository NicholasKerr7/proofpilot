import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface TimelineOrderRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: NextRequest, context: TimelineOrderRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/timeline/order`, {
    body: await readJsonBody(request),
    method: "PUT"
  });
}
