import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface CompleteDocumentRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: CompleteDocumentRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/documents/${id}/complete`, {
    method: "POST"
  });
}
