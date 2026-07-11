import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

export async function GET() {
  return proxyToProofPilotApi("/support/requests");
}

export async function POST(request: NextRequest) {
  return proxyToProofPilotApi("/support/requests", {
    body: await readJsonBody(request),
    method: "POST"
  });
}
