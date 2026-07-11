import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface CaseActivityRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: CaseActivityRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/activity${request.nextUrl.search}`);
}
