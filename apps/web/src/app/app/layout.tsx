import type { Metadata } from "next";
import { ProofPilotApp } from "@/components/app/proofpilot-app";

export const metadata: Metadata = {
  title: "ProofPilot Workspace",
  description: "Build, verify, and share structured case packets."
};

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  return (
    <>
      <ProofPilotApp portfolioMode={process.env.PROOFPILOT_MODE === "portfolio"} />
      {children}
    </>
  );
}
