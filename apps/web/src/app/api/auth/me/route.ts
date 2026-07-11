import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

export async function GET() {
  return proxyToProofPilotApi("/auth/me");
}

export async function PATCH(request: NextRequest) {
  return proxyToProofPilotApi("/auth/me", {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}
