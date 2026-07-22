import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseTasksRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, context: CaseTasksRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/tasks`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
