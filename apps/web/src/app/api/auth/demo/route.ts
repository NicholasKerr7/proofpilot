import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createAuthRequestHeaders,
  setAuthToken
} from "@/lib/server/proofpilot-api";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      body: JSON.stringify({
        email: process.env.PROOFPILOT_DEMO_EMAIL ?? "nicholas.kerr@proofpilot.test",
        password: process.env.PROOFPILOT_DEMO_PASSWORD ?? "Password123!"
      }),
      cache: "no-store",
      headers: createAuthRequestHeaders(request),
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
