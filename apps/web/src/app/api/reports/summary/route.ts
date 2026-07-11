import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

export async function GET(request: NextRequest) {
  return proxyToProofPilotApi(`/reports/summary${request.nextUrl.search}`);
}
