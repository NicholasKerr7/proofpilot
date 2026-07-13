import { NextResponse, type NextRequest } from "next/server";
import { fetchProofPilotApi } from "@/lib/server/proofpilot-api";

const forwardedHeaders = ["content-disposition", "content-type", "x-request-id"];

interface InvoiceDownloadRouteContext {
  params: Promise<{
    invoiceId: string;
  }>;
}

export async function GET(_request: NextRequest, context: InvoiceDownloadRouteContext) {
  const { invoiceId } = await context.params;

  try {
    const response = await fetchProofPilotApi(
      `/billing/invoices/${encodeURIComponent(invoiceId)}/download`
    );
    const headers = new Headers();
    headers.set("Cache-Control", "private, no-store");

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
