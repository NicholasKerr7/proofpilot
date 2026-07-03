import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseRemindersRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: CaseRemindersRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/reminders`);
}

export async function POST(request: NextRequest, context: CaseRemindersRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/cases/${id}/reminders`, {
    body: await readJsonBody(request),
    method: "POST"
  });
}
