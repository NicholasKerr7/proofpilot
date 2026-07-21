import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

export async function POST() {
  return proxyToProofPilotApi("/security/sessions/revoke-others", {
    method: "POST"
  });
}
