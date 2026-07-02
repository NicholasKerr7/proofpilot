import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface GenerateStatementRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: GenerateStatementRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/statement/generate`, {
    method: "POST"
  });
}
