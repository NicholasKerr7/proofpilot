import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authCookieName,
  createAuthRequestHeaders
} from "@/lib/server/proofpilot-api";
import { establishPortfolioDemoSession } from "@/lib/server/portfolio-demo-session";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  if (process.env.PROOFPILOT_MODE === "portfolio") {
    return establishPortfolioDemoSession(request, "start");
  }

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

    return createAuthenticatedResponse(payload.accessToken, payload.user);
  } catch {
    return NextResponse.json(
      { message: "ProofPilot API is offline. Start the API server, then retry." },
      { status: 503 }
    );
  }
}

function createAuthenticatedResponse(
  accessToken: string,
  user: unknown,
  maxAge = 7 * 24 * 60 * 60
) {
  const response = NextResponse.json({ user });
  response.cookies.set(authCookieName, accessToken, {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}
