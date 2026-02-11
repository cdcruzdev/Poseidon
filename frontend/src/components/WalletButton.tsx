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
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-[#0a1520] rounded-lg border border-[#1a3050]">
          <div className="w-2 h-2 rounded-full bg-[#4ade80]" />
          <span className="text-sm font-mono text-[#e0e8f0]">
            {shortenAddress(publicKey.toBase58())}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 text-sm font-medium text-[#8899aa] hover:text-[#e0e8f0] border border-[#1a3050] rounded-lg transition-colors hover:border-[#2a4060]"
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
      className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-[#e0e8f0] text-[#09090b] font-medium rounded-lg hover:bg-[#c8d8e8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className || ""}`}
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
