import type { Metadata } from "next";
import { ProofPilotApp } from "@/components/app/proofpilot-app";

export const metadata: Metadata = {
  title: "ProofPilot"
};

export default function Home() {
  return <ProofPilotApp portfolioMode={process.env.PROOFPILOT_MODE === "portfolio"} />;
}
