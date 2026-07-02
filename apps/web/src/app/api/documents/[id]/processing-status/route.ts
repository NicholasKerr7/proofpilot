import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface ProcessingStatusRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: ProcessingStatusRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/documents/${id}/processing-status`);
}
