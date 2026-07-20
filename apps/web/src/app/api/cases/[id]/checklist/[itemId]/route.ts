import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface ChecklistItemRouteContext {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
}

export async function PATCH(request: NextRequest, context: ChecklistItemRouteContext) {
  const { id, itemId } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/checklist/${itemId}`, {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}
