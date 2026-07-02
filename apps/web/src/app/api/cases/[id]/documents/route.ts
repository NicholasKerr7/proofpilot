import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseDocumentsRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: CaseDocumentsRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/documents`);
}

export async function POST(request: NextRequest, context: CaseDocumentsRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/documents`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
