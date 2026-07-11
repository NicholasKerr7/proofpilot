import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const authCookieName = "proofpilot_token";

const fallbackApiUrl = "http://localhost:4000";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? fallbackApiUrl;
}

function parseBody(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

export async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(authCookieName)?.value;
}

export async function setAuthToken(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(authCookieName, token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function clearAuthToken() {
  const cookieStore = await cookies();
  cookieStore.delete(authCookieName);
}

export async function fetchProofPilotApi(path: string, init: RequestInit = {}) {
  const token = await getAuthToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
}

export async function proxyToProofPilotApi(path: string, init: RequestInit = {}) {
  try {
    const response = await fetchProofPilotApi(path, init);
    const payload = parseBody(await response.text());

    return NextResponse.json(payload ?? {}, {
      status: response.status
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

export async function readJsonBody(request: NextRequest) {
  const text = await request.text();
  return text ? text : "{}";
}
