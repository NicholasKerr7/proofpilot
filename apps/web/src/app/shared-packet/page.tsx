import type { Metadata } from "next";
import { SharedPacketPage } from "@/components/app/packet-sharing/shared-packet-page";

export const metadata: Metadata = {
  description: "Open a case packet shared through ProofPilot.",
  robots: { follow: false, index: false },
  title: "Shared packet | ProofPilot"
};

export default function SharedPacketRoute() {
  return <SharedPacketPage />;
}
