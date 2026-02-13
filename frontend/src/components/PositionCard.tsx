"use client";

import { useState } from "react";
import AnimateHeight from "@/components/AnimateHeight";
import type { Position } from "@/types/position";

interface PositionCardProps {
  position: Position;
  expanded: boolean;
  onToggle: () => void;
}

export default function PositionCard({ position: pos, expanded, onToggle }: PositionCardProps) {
  return (
    <div className="bg-[#0d1926]/80 border border-[#1a3050] rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 cursor-pointer hover:bg-[#0d1d30]/50 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[#e0e8f0] font-semibold text-sm">{pos.pair}</span>
            <span className="text-xs text-[#5a7090] bg-[#1a3050] px-2 py-0.5 rounded">{pos.dex}</span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: pos.status === "in-range" ? "#4ade80" : "#f87171",
                backgroundColor: pos.status === "in-range" ? "#4ade8015" : "#f8717115",
              }}
            >
              {pos.status === "in-range" ? "● In Range" : "○ Out of Range"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#5a7090]">{pos.age} old</span>
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
            <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">APY</p>
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
              <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">Next Rebalance</p>
              <p className="text-sm font-mono text-[#8899aa]">{pos.nextRebalance}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="px-4 py-2 text-xs bg-[#1a3050] text-[#7ec8e8] rounded-lg hover:bg-[#1a3050]/80 transition-colors cursor-pointer">
              Add Liquidity
            </button>
            <button className="px-4 py-2 text-xs bg-[#1a3050] text-[#fbbf24] rounded-lg hover:bg-[#1a3050]/80 transition-colors cursor-pointer">
              Withdraw
            </button>
            <button className="px-4 py-2 text-xs bg-[#1a3050] text-[#8899aa] rounded-lg hover:bg-[#1a3050]/80 transition-colors cursor-pointer">
              View on Solscan
            </button>
          </div>
        </div>
      </AnimateHeight>
    </div>
  );
}
