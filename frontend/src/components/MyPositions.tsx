"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePositions } from "@/hooks/usePositions";
import PositionList from "@/components/PositionList";

export default function MyPositions() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { positions, loading } = usePositions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <PositionList positions={[]} loading={true} />;

  if (!connected) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl tracking-wider text-white" style={{ fontFamily: "var(--font-bebas)" }}>
            MY POSITIONS
          </h2>
        </div>
        <div className="bg-[#0d1926]/80 backdrop-blur-sm border border-[#1a3050] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1a3050]/50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5a7090" strokeWidth="1.5">
              <path d="M19 7V4a1 1 0 00-1-1H5a2 2 0 00-2 2v14a2 2 0 002 2h13a1 1 0 001-1v-3" />
              <path d="M19 7h-8a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2z" />
              <circle cx="16" cy="12" r="1.5" fill="#5a7090" />
            </svg>
          </div>
          <h3 className="text-lg text-[#b8c8d8] mb-3" style={{ fontFamily: "var(--font-bebas)" }}>VIEW YOUR POSITIONS</h3>
          <p className="text-sm text-[#5a7090] mb-6">Connect your wallet to view and manage your liquidity positions</p>
          <button onClick={() => setVisible(true)} className="px-6 py-2.5 bg-[#e0e8f0] text-[#0a1520] font-medium rounded-lg hover:bg-[#c8d8e8] transition-colors cursor-pointer">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <PositionList
      positions={positions}
      loading={loading}
      emptyMessage="No positions found. Deposit liquidity to get started."
    />
  );
}
