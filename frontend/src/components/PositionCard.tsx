"use client";

import Image from "next/image";
import AnimateHeight from "@/components/AnimateHeight";
import type { Position } from "@/types/position";

const DEX_LOGOS: Record<string, string> = {
  Meteora: "/meteora-logo.svg",
  meteora: "/meteora-logo.svg",
  ORCA: "/orca-logo.png",
  Orca: "/orca-logo.png",
  orca: "/orca-logo.png",
  Raydium: "/raydium-logo.png",
  raydium: "/raydium-logo.png",
};

interface PositionCardProps {
  position: Position;
  expanded: boolean;
  onToggle: () => void;
  onClose?: (id: string) => void;
  closing?: boolean;
  onRebalanceToggle?: (positionMint: string, currentlyEnabled: boolean) => void;
  rebalanceToggling?: boolean;
}

export default function PositionCard({
  position: pos,
  expanded,
  onToggle,
  onClose,
  closing,
  onRebalanceToggle,
  rebalanceToggling,
}: PositionCardProps) {
  const rebalanceOn = pos.autoRebalance ?? false;

  const handleRebalanceToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos.positionMint && onRebalanceToggle) {
      onRebalanceToggle(pos.positionMint, rebalanceOn);
    }
  };

  return (
    <div className="bg-[#0d1926]/80 border border-[#1a3050] rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 cursor-pointer hover:bg-[#0d1d30]/50 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[#e0e8f0] font-semibold text-sm">{pos.pair}</span>
            <span className="text-xs text-[#5a7090] bg-[#1a3050] px-2 py-0.5 rounded flex items-center gap-1.5">
              {DEX_LOGOS[pos.dex] && (
                <Image src={DEX_LOGOS[pos.dex]} alt={pos.dex} width={14} height={14} className="rounded-full" />
              )}
              {pos.dex}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: pos.status === "in-range" ? "#4ade80" : "#f87171",
                backgroundColor: pos.status === "in-range" ? "#4ade8015" : "#f8717115",
              }}
            >
              {pos.status === "in-range" ? "● In Range" : "○ Out of Range"}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: rebalanceOn ? "#fbbf24" : "#5a7090",
                backgroundColor: rebalanceOn ? "#fbbf2415" : "#5a709015",
              }}
            >
              {rebalanceOn ? "⟳ Auto-Rebalance" : "Manual"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#5a7090]">{pos.age && pos.age !== "-" ? `${pos.age} old` : ""}</span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a7090" strokeWidth="2"
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Deposited</p>
            <p className="text-sm font-mono text-[#b8c8d8]">{pos.deposited}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Current</p>
            <p className="text-sm font-mono text-[#e0e8f0]">{pos.current}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">P&L</p>
            <p className="text-sm font-mono" style={{ color: pos.pnl.startsWith("+") ? "#4ade80" : "#f87171" }}>
              {pos.pnl} ({pos.pnlPct})
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Est. 24h Yield</p>
            <p className="text-sm font-mono text-[#7ec8e8]">{pos.apy}</p>
          </div>
        </div>
      </button>

      <AnimateHeight open={expanded}>
        <div className="px-4 pb-4 border-t border-[#1a3050]/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div>
              <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Range</p>
              <p className="text-sm font-mono text-[#b8c8d8]">{pos.range}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Fees Earned</p>
              <p className="text-sm font-mono text-[#4ade80]">{pos.feesEarned}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Rebalances</p>
              <p className="text-sm font-mono text-[#fbbf24]">{pos.rebalances}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Auto-Rebalance</p>
              <button
                onClick={handleRebalanceToggle}
                disabled={rebalanceToggling || !pos.positionMint}
                className="flex items-center gap-2 mt-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div
                  className="w-8 h-4 rounded-full relative transition-colors duration-200"
                  style={{ backgroundColor: rebalanceOn ? "#fbbf24" : "#1a3050" }}
                >
                  <div
                    className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all duration-200"
                    style={{ left: rebalanceOn ? "18px" : "2px" }}
                  />
                </div>
                <span className="text-xs font-mono" style={{ color: rebalanceOn ? "#fbbf24" : "#5a7090" }}>
                  {rebalanceToggling ? "..." : rebalanceOn ? "On" : "Off"}
                </span>
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {onClose && (
              <button
                onClick={() => onClose(pos.id)}
                disabled={closing}
                className="px-4 py-2 text-xs bg-[#1a3050] text-[#f87171] rounded-lg hover:bg-[#f87171]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {closing ? "Closing..." : "Close Position"}
              </button>
            )}
            <a
              href={`https://orbmarkets.io/tx/${pos.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs bg-[#1a3050] text-[#7ec8e8] rounded-lg hover:bg-[#1a3050]/80 transition-colors cursor-pointer"
            >
              View on Explorer
            </a>
          </div>
        </div>
      </AnimateHeight>
    </div>
  );
}
