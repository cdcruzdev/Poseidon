"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import type { Pool } from "@/lib/api";

interface DepositModalProps {
  pool: Pool | null;
  onClose: () => void;
}

const dexColors: Record<string, string> = {
  meteora: "#E4B740",
  orca: "#00A3FF",
  raydium: "#5AC4BE",
};

// Token colors
const tokenColors: Record<string, string> = {
  SOL: "#9945FF",
  USDC: "#2775CA",
  USDT: "#26A17B",
  RAY: "#5AC4BE",
  ORCA: "#FF7A00",
  JUP: "#5DADE2",
  BONK: "#F5A623",
};

export default function DepositModal({ pool, onClose }: DepositModalProps) {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const openWalletModal = () => setVisible(true);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "confirm" | "success">("input");

  // Fetch SOL balance when connected
  useEffect(() => {
    if (publicKey && connection) {
      connection.getBalance(publicKey).then((bal) => {
        setBalance(bal / 1e9);
      });
    }
  }, [publicKey, connection]);

  if (!pool) return null;

  const dexColor = dexColors[pool.dex] || "#5eead4";
  const getTokenColor = (symbol: string) => tokenColors[symbol] || "#5eead4";

  const handleDeposit = async () => {
    if (!connected) {
      openWalletModal();
      return;
    }

    setLoading(true);
    setStep("confirm");

    // Simulate transaction for demo
    // In production, this would build and send the actual LP transaction
    setTimeout(() => {
      setStep("success");
      setLoading(false);
    }, 2000);
  };

  const handleClose = () => {
    setStep("input");
    setAmountA("");
    setAmountB("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#18181b] rounded-2xl border border-[#27272a] w-full max-w-md overflow-hidden shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div
                className="w-8 h-8 rounded-full border-2 border-[#18181b] flex items-center justify-center text-xs font-bold text-[#09090b]"
                style={{ backgroundColor: getTokenColor(pool.tokenA.symbol) }}
              >
                {pool.tokenA.symbol.slice(0, 2)}
              </div>
              <div
                className="w-8 h-8 rounded-full border-2 border-[#18181b] flex items-center justify-center text-xs font-bold text-[#09090b]"
                style={{ backgroundColor: getTokenColor(pool.tokenB.symbol) }}
              >
                {pool.tokenB.symbol.slice(0, 2)}
              </div>
            </div>
            <div>
              <h3 className="font-semibold">
                {pool.tokenA.symbol}/{pool.tokenB.symbol}
              </h3>
              <span
                className="text-xs px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${dexColor}20`, color: dexColor }}
              >
                {pool.dex}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[#71717a] hover:text-[#fafafa] transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "input" && (
            <>
              {/* Wallet Status */}
              {!connected ? (
                <div className="mb-6 p-4 bg-[#27272a] rounded-xl text-center">
                  <p className="text-[#a1a1aa] mb-3">Connect wallet to deposit</p>
                  <button
                    onClick={openWalletModal}
                    className="btn btn-primary"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="mb-6 p-3 bg-[#27272a] rounded-lg flex items-center justify-between">
                  <span className="text-sm text-[#a1a1aa]">Wallet Balance</span>
                  <span className="font-mono text-sm">
                    {balance !== null ? `${balance.toFixed(4)} SOL` : "Loading..."}
                  </span>
                </div>
              )}

              {/* Token A Input */}
              <div className="mb-4">
                <label className="block text-sm text-[#a1a1aa] mb-2">
                  {pool.tokenA.symbol} Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountA}
                    onChange={(e) => setAmountA(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-[#27272a] border border-[#3f3f46] rounded-lg focus:border-[#52525b] focus:outline-none text-right pr-20"
                    disabled={!connected}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a1a1aa] font-medium">
                    {pool.tokenA.symbol}
                  </span>
                </div>
              </div>

              {/* Plus Icon */}
              <div className="flex justify-center my-2">
                <div className="w-8 h-8 rounded-full bg-[#3f3f46] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
              </div>

              {/* Token B Input */}
              <div className="mb-6">
                <label className="block text-sm text-[#a1a1aa] mb-2">
                  {pool.tokenB.symbol} Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountB}
                    onChange={(e) => setAmountB(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-[#27272a] border border-[#3f3f46] rounded-lg focus:border-[#52525b] focus:outline-none text-right pr-20"
                    disabled={!connected}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a1a1aa] font-medium">
                    {pool.tokenB.symbol}
                  </span>
                </div>
              </div>

              {/* Pool Info */}
              <div className="p-4 bg-[#27272a] rounded-xl mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#a1a1aa]">Pool TVL</span>
                  <span>${(pool.tvl / 1_000_000).toFixed(2)}M</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#a1a1aa]">Est. 24h Yield</span>
                  <span className="text-[#4ade80]">{pool.apr24h.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#a1a1aa]">Fee Tier</span>
                  <span>{(pool.feeRate * 100).toFixed(2)}%</span>
                </div>
              </div>

              {/* Deposit Button */}
              <button
                onClick={handleDeposit}
                disabled={!connected || !amountA || !amountB}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!connected ? "Connect Wallet" : "Preview Deposit"}
              </button>
            </>
          )}

          {step === "confirm" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-[#3f3f46] border-t-[#5eead4] rounded-full animate-spin" />
              <h3 className="text-xl font-semibold mb-2">Confirming Transaction</h3>
              <p className="text-[#a1a1aa]">Please approve in your wallet...</p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4ade80]/20 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Deposit Successful!</h3>
              <p className="text-[#a1a1aa] mb-6">
                Your LP position has been created with privacy enabled.
              </p>
              <button onClick={handleClose} className="btn btn-primary">
                Done
              </button>
            </div>
          )}
        </div>

        {/* Privacy Notice */}
        {step === "input" && (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 p-3 bg-[#5eead4]/10 border border-[#5eead4]/20 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5eead4" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-xs text-[#5eead4]">
                Position will be encrypted with Arcium privacy
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
