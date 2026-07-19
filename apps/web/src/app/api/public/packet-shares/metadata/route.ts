import type { NextRequest } from "next/server";
import {
  proxyToPublicProofPilotApi,
  readJsonBody
} from "@/lib/server/proofpilot-api";

export async function POST(request: NextRequest) {
  return proxyToPublicProofPilotApi("/packet-shares/metadata", {
    body: await readJsonBody(request),
    method: "POST"
  });
}
