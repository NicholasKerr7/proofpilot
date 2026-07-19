import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface PacketSharePreparationRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: PacketSharePreparationRouteContext
) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/packet-shares/prepare`);
}
