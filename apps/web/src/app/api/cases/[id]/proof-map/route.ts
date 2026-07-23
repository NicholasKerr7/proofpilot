import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface ProofMapRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: ProofMapRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/proof-map`);
}
