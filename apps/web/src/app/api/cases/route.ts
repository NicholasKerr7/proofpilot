import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

export async function GET() {
  return proxyToProofPilotApi("/cases");
}

export async function POST(request: NextRequest) {
  return proxyToProofPilotApi("/cases", {
    body: await readJsonBody(request),
    method: "POST"
  });
}
