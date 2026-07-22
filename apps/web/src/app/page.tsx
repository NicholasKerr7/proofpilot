import { ProofPilotApp } from "@/components/app/proofpilot-app";

export default function Home() {
  return <ProofPilotApp portfolioMode={process.env.PROOFPILOT_MODE === "portfolio"} />;
}
