import { NextResponse, type NextRequest } from "next/server";
import { fetchProofPilotApi } from "@/lib/server/proofpilot-api";

const forwardedHeaders = ["cache-control", "content-disposition", "content-type", "x-request-id"];

export async function GET(request: NextRequest) {
  try {
    const response = await fetchProofPilotApi(`/reports/export${request.nextUrl.search}`);
    const headers = new Headers();

    for (const headerName of forwardedHeaders) {
      const value = response.headers.get(headerName);

      if (value) {
        headers.set(headerName, value);
      }
    }

    return new Response(response.body, {
      status: response.status,
      headers
    });
  } catch {
    return NextResponse.json(
      {
        message: "ProofPilot API is offline. Start Docker services and the API server, then retry."
      },
      { status: 503 }
    );
  }
}
