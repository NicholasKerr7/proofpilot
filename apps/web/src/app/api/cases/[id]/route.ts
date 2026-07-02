import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: CaseRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}`);
}

export async function PATCH(request: NextRequest, context: CaseRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}`, {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}

export async function DELETE(_request: NextRequest, context: CaseRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}`, {
    method: "DELETE"
  });
}
