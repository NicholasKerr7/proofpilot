import type { NextRequest } from "next/server";
import {
  proxyToPublicProofPilotApi,
  readJsonBody
} from "@/lib/server/proofpilot-api";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  return proxyToPublicProofPilotApi("/packet-shares/content", {
    body: await readJsonBody(request),
    headers: authorization ? { Authorization: authorization } : undefined,
    method: "POST"
  });
}
