import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface TaskRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: TaskRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/tasks/${id}`, {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}

export async function DELETE(_request: NextRequest, context: TaskRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/tasks/${id}`, {
    method: "DELETE"
  });
}
