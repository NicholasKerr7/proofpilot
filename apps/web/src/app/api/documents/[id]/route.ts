import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface DocumentRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: DocumentRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/documents/${id}`);
}

export async function DELETE(_request: NextRequest, context: DocumentRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/documents/${id}`, {
    method: "DELETE"
  });
}
