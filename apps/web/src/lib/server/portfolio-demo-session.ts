import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  authCookieName,
  createAuthRequestHeaders
} from "@/lib/server/proofpilot-api";

const portfolioVisitorCookieName = "proofpilot_portfolio_visitor";

export async function establishPortfolioDemoSession(
  request: NextRequest,
  action: "reset" | "start"
) {
  const accessKey = process.env.PORTFOLIO_DEMO_ACCESS_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  if (!accessKey) {
    return NextResponse.json(
      { message: "The portfolio demo is not configured yet." },
      { status: 503 }
    );
  }

  const existingVisitorToken = request.cookies.get(
    portfolioVisitorCookieName
  )?.value;
  const visitorToken = isVisitorToken(existingVisitorToken)
    ? existingVisitorToken
    : randomBytes(32).toString("base64url");

  try {
    const headers = createAuthRequestHeaders(request);
    headers.set("X-ProofPilot-Demo-Key", accessKey);
    const endpoint =
      action === "reset"
        ? "/auth/portfolio-demo/reset"
        : "/auth/portfolio-demo";
    const response = await fetch(`${apiUrl}${endpoint}`, {
      body: JSON.stringify({ visitorToken }),
      cache: "no-store",
      headers,
      method: "POST"
    });
    const payload = (await response.json()) as {
      accessToken?: string;
      user?: {
        portfolioDemoExpiresAt?: string | null;
      };
      message?: string;
    };

    if (!response.ok || !payload.accessToken || !payload.user) {
      return NextResponse.json(payload, { status: response.status });
    }

    const expiresAt = payload.user.portfolioDemoExpiresAt
      ? new Date(payload.user.portfolioDemoExpiresAt)
      : null;
    const maxAge = expiresAt
      ? Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1_000))
      : 2 * 60 * 60;
    const authenticatedResponse = NextResponse.json({ user: payload.user });
    authenticatedResponse.cookies.set(authCookieName, payload.accessToken, {
      httpOnly: true,
      maxAge,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    authenticatedResponse.cookies.set(
      portfolioVisitorCookieName,
      visitorToken,
      {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      }
    );
    return authenticatedResponse;
  } catch {
    return NextResponse.json(
      { message: "ProofPilot API is offline. Start the API server, then retry." },
      { status: 503 }
    );
  }
}

function isVisitorToken(value: string | undefined): value is string {
  return Boolean(
    value &&
      value.length >= 32 &&
      value.length <= 128 &&
      /^[A-Za-z0-9_-]+$/.test(value)
  );
}
