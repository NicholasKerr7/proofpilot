import { NextResponse, type NextRequest } from "next/server";
import { establishPortfolioDemoSession } from "@/lib/server/portfolio-demo-session";

export async function POST(request: NextRequest) {
  if (process.env.PROOFPILOT_MODE !== "portfolio") {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  return establishPortfolioDemoSession(request, "reset");
}
