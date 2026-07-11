import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface SupportRequestRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: SupportRequestRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/support/requests/${id}`);
}
