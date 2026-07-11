import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

export async function GET(request: NextRequest) {
  return proxyToProofPilotApi(`/search${request.nextUrl.search}`);
}
