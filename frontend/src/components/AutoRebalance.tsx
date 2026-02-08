"use client";

import { useState } from "react";
import Toggle from "@/components/Toggle";
import AnimateHeight from "@/components/AnimateHeight";

interface AutoRebalanceProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  targetYield: string;
  onTargetYieldChange: (yield_: string) => void;
}

const YIELD_OPTIONS = [
  { value: "0.05", label: "0.05%" },
  { value: "0.10", label: "0.10%" },
  { value: "0.15", label: "0.15%" },
  { value: "0.20", label: "0.20%" },
  { value: "0.25", label: "0.25%" },
];

export default function AutoRebalance({
  enabled,
  onEnabledChange,
  targetYield,
  onTargetYieldChange,
}: AutoRebalanceProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Auto-Rebalancing</span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-[#5a7090] hover:text-[#ffffff] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        </div>
        <Toggle enabled={enabled} onChange={onEnabledChange} />
      </div>

      <AnimateHeight open={showInfo}>
        <div className="mt-2 p-3 bg-[#0a1520]/60 rounded-lg text-xs text-[#8899aa]">
          Our agent monitors your position 24/7. If the price moves out of range 
          or yield drops below your target, we automatically rebalance to the optimal range.
        </div>
      </AnimateHeight>

      <AnimateHeight open={enabled}>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[#5a7090]">Target 24h Yield:</span>
          <select
            value={targetYield}
            onChange={(e) => onTargetYieldChange(e.target.value)}
            className="px-2 py-1 bg-[#0a1520]/60 border border-[#1a3050] rounded-md text-xs focus:border-[#2a4060] focus:outline-none cursor-pointer"
          >
            {YIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </AnimateHeight>
    </div>
  );
}
