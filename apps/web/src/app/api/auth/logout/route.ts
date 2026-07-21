import { NextResponse } from "next/server";
import {
  clearAuthToken,
  fetchProofPilotApi
} from "@/lib/server/proofpilot-api";

export async function POST() {
  try {
    await fetchProofPilotApi("/auth/logout", { method: "POST" });
  } catch {
    // The local session must still end if the API is temporarily unavailable.
  } finally {
    await clearAuthToken();
  }

  return NextResponse.json({ ok: true });
}
