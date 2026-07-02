import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface GeneratePacketRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: GeneratePacketRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/packet/generate`, {
    method: "POST"
  });
}
