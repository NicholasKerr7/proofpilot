import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

export async function PATCH() {
  return proxyToProofPilotApi("/inbox/read-all", { method: "PATCH" });
}
