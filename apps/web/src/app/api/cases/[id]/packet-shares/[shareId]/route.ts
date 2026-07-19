import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface PacketShareRouteContext {
  params: Promise<{ id: string; shareId: string }>;
}

export async function DELETE(_request: NextRequest, context: PacketShareRouteContext) {
  const { id, shareId } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/packet-shares/${shareId}`, {
    method: "DELETE"
  });
}
