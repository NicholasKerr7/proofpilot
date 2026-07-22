import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface ProviderImportRouteContext {
  params: Promise<{
    id: string;
    provider: string;
  }>;
}

export async function GET(_request: NextRequest, context: ProviderImportRouteContext) {
  const { id, provider } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/provider-imports/${provider}`);
}

export async function POST(request: NextRequest, context: ProviderImportRouteContext) {
  const { id, provider } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/provider-imports/${provider}`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
