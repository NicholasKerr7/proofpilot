import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface ReprocessDocumentRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: NextRequest, context: ReprocessDocumentRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/documents/${id}/reprocess`, {
    method: "POST"
  });
}
