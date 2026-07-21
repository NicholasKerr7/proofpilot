import type { NextRequest } from "next/server";
import {
  proxyToPublicProofPilotApi,
  readJsonBody
} from "@/lib/server/proofpilot-api";

export async function POST(request: NextRequest) {
  return proxyToPublicProofPilotApi("/auth/reset-password", {
    body: await readJsonBody(request),
    method: "POST"
  });
}
