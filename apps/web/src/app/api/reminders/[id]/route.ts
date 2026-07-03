import type { NextRequest } from "next/server";
import { proxyToProofPilotApi } from "@/lib/server/proofpilot-api";

interface ReminderRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(_request: NextRequest, context: ReminderRouteContext) {
  const { id } = await context.params;
  return proxyToProofPilotApi(`/reminders/${id}`, {
    method: "DELETE"
  });
}
