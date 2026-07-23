import type { NextRequest } from "next/server";
import {
  proxyToProofPilotApi,
  readJsonBody
} from "@/lib/server/proofpilot-api";

interface SubmissionsRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: SubmissionsRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/submissions`);
}

export async function POST(request: NextRequest, context: SubmissionsRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/submissions`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
