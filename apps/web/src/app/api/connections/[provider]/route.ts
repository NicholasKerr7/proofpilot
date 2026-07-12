import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface ConnectionRouteContext {
  params: Promise<{
    provider: string;
  }>;
}

export async function POST(_request: NextRequest, context: ConnectionRouteContext) {
  const { provider } = await context.params;
  return proxyToProofPilotApi(`/connections/${provider}`, { method: "POST" });
}

export async function DELETE(_request: NextRequest, context: ConnectionRouteContext) {
  const { provider } = await context.params;
  return proxyToProofPilotApi(`/connections/${provider}`, { method: "DELETE" });
}
