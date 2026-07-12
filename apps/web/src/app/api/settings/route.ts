import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

export async function GET() {
  return proxyToProofPilotApi("/settings");
}

export async function PATCH(request: NextRequest) {
  return proxyToProofPilotApi("/settings", {
    body: await readJsonBody(request),
    method: "PATCH"
  });
}
