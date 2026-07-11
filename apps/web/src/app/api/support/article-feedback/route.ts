import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

export async function POST(request: NextRequest) {
  return proxyToProofPilotApi("/support/article-feedback", {
    body: await readJsonBody(request),
    method: "POST"
  });
}
