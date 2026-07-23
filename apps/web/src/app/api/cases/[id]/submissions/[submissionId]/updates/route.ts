import type { NextRequest } from "next/server";
import {
  proxyToProofPilotApi,
  readJsonBody
} from "@/lib/server/proofpilot-api";

interface SubmissionUpdatesRouteContext {
  params: Promise<{
    id: string;
    submissionId: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: SubmissionUpdatesRouteContext
) {
  const { id, submissionId } = await context.params;
  return proxyToProofPilotApi(
    `/cases/${id}/submissions/${submissionId}/updates`,
    {
      body: await readJsonBody(request),
      method: "POST"
    }
  );
}
