"use client";

import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

interface WalletButtonProps {
  className?: string;
}

export default function WalletButton({ className }: WalletButtonProps) {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleConnect = () => {
    setVisible(true);
  };

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-[#18181b] rounded-lg border border-[#27272a]">
          <div className="w-2 h-2 rounded-full bg-[#4ade80]" />
          <span className="text-sm font-mono text-[#fafafa]">
            {shortenAddress(publicKey.toBase58())}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-[#fafafa] border border-[#27272a] rounded-lg transition-colors hover:border-[#3f3f46]"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className={`px-6 py-2.5 bg-[#fafaf9] text-[#09090b] font-medium rounded-lg hover:bg-[#e7e5e4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className || ""}`}
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
