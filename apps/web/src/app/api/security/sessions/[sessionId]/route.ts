import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  return proxyToProofPilotApi(`/security/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE"
  });
}
