"use client";

import { useState } from "react";

export interface Strategy {
  id: "conservative" | "balanced" | "aggressive";
  name: string;
  description: string;
  rangeWidth: string;
  rebalanceFreq: string;
  expectedApr: string;
  ilRisk: string;
  icon: JSX.Element;
}

const strategies: Strategy[] = [
  {
    id: "conservative",
    name: "Wide Range",
    description: "Wider price range, fewer rebalances. Lower yield but minimal impermanent loss risk.",
    rangeWidth: "±15%",
    rebalanceFreq: "~2x / week",
    expectedApr: "15-40%",
    ilRisk: "Low",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Optimized range for fee capture with manageable rebalance frequency. Best for most users.",
    rangeWidth: "±5%",
    rebalanceFreq: "~1x / day",
    expectedApr: "40-120%",
    ilRisk: "Medium",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: "aggressive",
    name: "Tight Range",
    description: "Concentrated liquidity for maximum fee capture. Higher yield but frequent rebalancing.",
    rangeWidth: "±1.5%",
    rebalanceFreq: "~4x / day",
    expectedApr: "120-400%",
    ilRisk: "High",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

const riskColors = {
  Low: "#22C55E",
  Medium: "#FBBF24",
  High: "#EF4444",
};

interface StrategyPresetsProps {
  selected: Strategy["id"];
  onSelect: (id: Strategy["id"]) => void;
}

export default function StrategyPresets({ selected, onSelect }: StrategyPresetsProps) {
  const [expanded, setExpanded] = useState(false);

  const selectedStrategy = strategies.find((s) => s.id === selected)!;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#e0e8f0]">Strategy</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${riskColors[selectedStrategy.ilRisk as keyof typeof riskColors]}15`,
              color: riskColors[selectedStrategy.ilRisk as keyof typeof riskColors],
              border: `1px solid ${riskColors[selectedStrategy.ilRisk as keyof typeof riskColors]}30`,
            }}
          >
            {selectedStrategy.name}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[#5a7090] transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {strategies.map((strategy) => {
            const isSelected = strategy.id === selected;
            const riskColor = riskColors[strategy.ilRisk as keyof typeof riskColors];

            return (
              <button
                key={strategy.id}
                onClick={() => {
                  onSelect(strategy.id);
                  setExpanded(false);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "border-[#F59E0B]/40 bg-[#F59E0B]/5"
                    : "border-[#1a3050] bg-[#0a1520]/60 hover:border-[#2a4060]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={isSelected ? "text-[#F59E0B]" : "text-[#5a7090]"}>
                      {strategy.icon}
                    </span>
                    <span className="text-sm font-medium text-[#e0e8f0]">{strategy.name}</span>
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${riskColor}15`,
                      color: riskColor,
                    }}
                  >
                    {strategy.ilRisk} IL
                  </span>
                </div>
                <p className="text-xs text-[#5a7090] mb-2">{strategy.description}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[#5a7090]">Range</span>
                    <p className="text-[#8899aa] font-mono">{strategy.rangeWidth}</p>
                  </div>
                  <div>
                    <span className="text-[#5a7090]">Rebalances</span>
                    <p className="text-[#8899aa]">{strategy.rebalanceFreq}</p>
                  </div>
                  <div>
                    <span className="text-[#5a7090]">Est. APR</span>
                    <p className="text-[#8899aa] font-mono">{strategy.expectedApr}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
