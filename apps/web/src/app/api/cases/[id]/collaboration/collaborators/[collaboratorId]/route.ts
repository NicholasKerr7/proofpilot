import type { NextRequest } from "next/server";
import { proxyToProofPilotApi, readJsonBody } from "@/lib/server/proofpilot-api";

interface CaseCollaboratorRouteContext {
  params: Promise<{
    collaboratorId: string;
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: CaseCollaboratorRouteContext) {
  const { collaboratorId, id } = await context.params;
  return proxyToProofPilotApi(
    `/cases/${id}/collaboration/collaborators/${collaboratorId}`,
    {
      body: await readJsonBody(request),
      method: "PATCH"
    }
  );
}

export async function DELETE(_request: NextRequest, context: CaseCollaboratorRouteContext) {
  const { collaboratorId, id } = await context.params;
  return proxyToProofPilotApi(
    `/cases/${id}/collaboration/collaborators/${collaboratorId}`,
    { method: "DELETE" }
  );
}
