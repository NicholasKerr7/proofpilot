import { NextResponse } from "next/server";
import { clearAuthToken } from "@/lib/server/proofpilot-api";

export async function POST() {
  await clearAuthToken();
  return NextResponse.json({ ok: true });
}
