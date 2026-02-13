"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import PositionList from "@/components/PositionList";
import type { Position } from "@/types/position";
import { API_BASE } from "@/lib/api";

export default function MyPositions() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [mounted, setMounted] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchPositions = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/positions?wallet=${publicKey.toBase58()}`);
      const json = await res.json();
      if (json.success && json.data?.positions) {
        // Map API response to our Position type
        const mapped: Position[] = json.data.positions.map((p: any, i: number) => ({
          id: p.address || p.mint || `pos-${i}`,
          pair: p.pair || `${p.tokenA?.symbol || "?"}/${p.tokenB?.symbol || "?"}`,
          dex: p.dex || p.source || "unknown",
          deposited: p.deposited || p.totalValue ? `$${Number(p.totalValue || 0).toFixed(2)}` : "$0.00",
          current: p.currentValue ? `$${Number(p.currentValue).toFixed(2)}` : p.deposited || "$0.00",
          pnl: p.pnl ? `$${Number(p.pnl).toFixed(2)}` : "$0.00",
          pnlPct: p.pnlPct ? `${Number(p.pnlPct).toFixed(1)}%` : "0.0%",
          apy: p.apy ? `${Number(p.apy).toFixed(1)}%` : p.apr ? `${Number(p.apr).toFixed(1)}%` : "0.0%",
          range: p.range || (p.tickLower !== undefined ? `${p.priceLower?.toFixed(4)} - ${p.priceUpper?.toFixed(4)}` : "Full Range"),
          status: p.inRange === false ? "out-of-range" : "in-range",
          rebalances: p.rebalances || 0,
          age: p.createdAt ? getAge(p.createdAt) : "New",
          feesEarned: p.feesEarned ? `$${Number(p.feesEarned).toFixed(2)}` : "$0.00",
          nextRebalance: p.nextRebalance || "Monitoring",
        }));
        setPositions(mapped);
      }
    } catch (err) {
      console.warn("Failed to fetch positions:", err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPositions();
      const interval = setInterval(fetchPositions, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, fetchPositions]);

  const handleConnect = () => { setVisible(true); };

  return (
    <section className="max-w-2xl mx-auto">
      {!mounted && <PositionList positions={[]} loading={true} />}

      {mounted && !connected && (
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
            <h3 className="text-lg text-[#b8c8d8] mb-3" style={{ fontFamily: "var(--font-bebas)" }}>
              VIEW YOUR POSITIONS
            </h3>
            <p className="text-sm text-[#5a7090] mb-6">Connect your wallet to view and manage your liquidity positions</p>
            <button onClick={handleConnect} className="px-6 py-2.5 bg-[#e0e8f0] text-[#0a1520] font-medium rounded-lg hover:bg-[#c8d8e8] transition-colors cursor-pointer">
              Connect Wallet
            </button>
          </div>
        </div>
      )}

      {mounted && connected && (
        <PositionList positions={positions} loading={loading} emptyMessage="No positions found. Deposit liquidity to get started." />
      )}
    </section>
  );
}

function getAge(timestamp: number | string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
