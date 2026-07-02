import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface TimelineRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: TimelineRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/timeline`);
}

export async function POST(request: NextRequest, context: TimelineRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/timeline`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
