import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface StatementGuidanceRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: NextRequest, context: StatementGuidanceRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/statement/guidance`, {
    body: await readJsonBody(request),
    method: "PUT"
  });
}
