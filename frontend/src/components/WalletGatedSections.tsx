"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import MyPositions from "./MyPositions";
import AgentActivityLog from "./AgentActivityLog";
import AgentReasoningPanel from "./AgentReasoningPanel";
import AgentPerformance from "./AgentPerformance";

export default function WalletGatedSections() {
  const { connected } = useWallet();

  if (!connected) return null;

  return (
    <>
      {/* My Positions Section */}
      <section className="mb-10">
        <MyPositions />
      </section>

      {/* Agent Intelligence Section - Side by Side */}
      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <AgentActivityLog />
        <AgentReasoningPanel />
      </section>

      {/* Agent Performance */}
      <section className="mb-10 max-w-2xl mx-auto">
        <AgentPerformance />
      </section>
    </>
  );
}
