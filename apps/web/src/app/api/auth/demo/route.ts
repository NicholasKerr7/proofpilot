import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import {
  authCookieName,
  createAuthRequestHeaders
} from "@/lib/server/proofpilot-api";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const portfolioVisitorCookieName = "proofpilot_portfolio_visitor";

export async function POST(request: NextRequest) {
  if (process.env.PROOFPILOT_MODE === "portfolio") {
    return createPortfolioDemoSession(request);
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

async function createPortfolioDemoSession(request: NextRequest) {
  const accessKey = process.env.PORTFOLIO_DEMO_ACCESS_KEY;

  if (!accessKey) {
    return NextResponse.json(
      { message: "The portfolio demo is not configured yet." },
      { status: 503 }
    );
  }

  const existingVisitorToken = request.cookies.get(portfolioVisitorCookieName)?.value;
  const visitorToken = isVisitorToken(existingVisitorToken)
    ? existingVisitorToken
    : randomBytes(32).toString("base64url");

  try {
    const headers = createAuthRequestHeaders(request);
    headers.set("X-ProofPilot-Demo-Key", accessKey);
    const response = await fetch(`${apiUrl}/auth/portfolio-demo`, {
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
    const authenticatedResponse = createAuthenticatedResponse(
      payload.accessToken,
      payload.user,
      maxAge
    );
    authenticatedResponse.cookies.set(portfolioVisitorCookieName, visitorToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    return authenticatedResponse;
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

function isVisitorToken(value: string | undefined): value is string {
  return Boolean(
    value && value.length >= 32 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value)
  );
}
