import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseStatementRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: CaseStatementRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/statement`);
}

export async function PUT(request: NextRequest, context: CaseStatementRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/statement`, {
    body: await readJsonBody(request),
    method: "PUT"
  });
}
