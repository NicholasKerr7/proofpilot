import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface NotificationRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(_request: NextRequest, context: NotificationRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/notifications/${id}/read`, {
    method: "PATCH"
  });
}
