import { NextResponse, type NextRequest } from "next/server";
import { readJsonBody, setAuthToken } from "@/lib/server/proofpilot-api";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      body: await readJsonBody(request),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const payload = (await response.json()) as {
      accessToken?: string;
      user?: unknown;
      message?: string;
    };

    if (!response.ok || !payload.accessToken) {
      return NextResponse.json(payload, { status: response.status });
    }

    await setAuthToken(payload.accessToken);
    return NextResponse.json({ user: payload.user });
  } catch {
    return NextResponse.json(
      { message: "ProofPilot API is offline. Start the API server, then retry." },
      { status: 503 }
    );
  }
}
