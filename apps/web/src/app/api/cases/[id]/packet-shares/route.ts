import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface PacketSharesRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: PacketSharesRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/packet-shares`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
