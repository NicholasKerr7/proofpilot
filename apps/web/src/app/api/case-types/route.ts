import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

export async function GET() {
  return proxyToProofPilotApi("/case-types");
}
