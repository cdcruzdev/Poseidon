"use client";

import { useState } from "react";

interface PerformancePeriod {
  label: string;
  totalActions: number;
  rebalances: number;
  migrations: number;
  gasSpent: string;
  feesEarned: string;
  netProfit: string;
  ilSaved: string;
  avgConfidence: number;
  successRate: number;
  uptimePercent: number;
}

const periods: PerformancePeriod[] = [
  {
    label: "24h",
    totalActions: 12,
    rebalances: 4,
    migrations: 1,
    gasSpent: "0.018 SOL",
    feesEarned: "$42.18",
    netProfit: "$38.72",
    ilSaved: "$14.30",
    avgConfidence: 88,
    successRate: 100,
    uptimePercent: 100,
  },
  {
    label: "7d",
    totalActions: 67,
    rebalances: 22,
    migrations: 5,
    gasSpent: "0.112 SOL",
    feesEarned: "$284.56",
    netProfit: "$263.12",
    ilSaved: "$89.44",
    avgConfidence: 85,
    successRate: 97,
    uptimePercent: 99.8,
  },
  {
    label: "30d",
    totalActions: 241,
    rebalances: 89,
    migrations: 14,
    gasSpent: "0.482 SOL",
    feesEarned: "$1,142.30",
    netProfit: "$1,048.62",
    ilSaved: "$312.88",
    avgConfidence: 84,
    successRate: 95,
    uptimePercent: 99.6,
  },
];

function barWidth(value: number, max: number): string {
  return `${Math.min((value / max) * 100, 100)}%`;
}

export default function AgentPerformance() {
  const [activePeriod, setActivePeriod] = useState(0);
  const p = periods[activePeriod];

  const stats = [
    {
      label: "Fees Earned",
      value: p.feesEarned,
      color: "#4ade80",
    },
    {
      label: "Net Profit",
      value: p.netProfit,
      sub: `after ${p.gasSpent} gas`,
      color: "#4ade80",
    },
    {
      label: "IL Saved",
      value: p.ilSaved,
      sub: "vs static position",
      color: "#8B5CF6",
    },
    {
      label: "Gas Spent",
      value: p.gasSpent,
      color: "#fbbf24",
    },
  ];

  return (
    <div className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1a3050] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <h3
            className="font-semibold text-sm tracking-wider text-[#e0e8f0]"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            AGENT PERFORMANCE
          </h3>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-[#0a1520]/60 rounded-lg p-0.5">
          {periods.map((period, i) => (
            <button
              key={period.label}
              onClick={() => setActivePeriod(i)}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                activePeriod === i
                  ? "bg-[#1a3050] text-[#e0e8f0]"
                  : "text-[#5a7090] hover:text-[#8899aa]"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#0a1520]/60 rounded-lg p-3"
          >
            <p className="text-[10px] text-[#5a7090] uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-semibold font-mono" style={{ color: stat.color }}>
              {stat.value}
            </p>
            {stat.sub && (
              <p className="text-[10px] text-[#5a7090] mt-0.5">{stat.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Progress Bars */}
      <div className="px-4 pb-4 space-y-3">
        {/* Success Rate */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-[#8899aa]">Success Rate</span>
            <span className="text-xs font-mono text-[#4ade80]">{p.successRate}%</span>
          </div>
          <div className="h-1.5 bg-[#1a3050] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${p.successRate}%`,
                backgroundColor: "#4ade80",
              }}
            />
          </div>
        </div>

        {/* Avg Confidence */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-[#8899aa]">Avg Confidence</span>
            <span className="text-xs font-mono text-[#8B5CF6]">{p.avgConfidence}%</span>
          </div>
          <div className="h-1.5 bg-[#1a3050] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${p.avgConfidence}%`,
                backgroundColor: "#8B5CF6",
              }}
            />
          </div>
        </div>

        {/* Uptime */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-[#8899aa]">Uptime</span>
            <span className="text-xs font-mono text-[#3B82F6]">{p.uptimePercent}%</span>
          </div>
          <div className="h-1.5 bg-[#1a3050] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${p.uptimePercent}%`,
                backgroundColor: "#3B82F6",
              }}
            />
          </div>
        </div>

        {/* Action breakdown */}
        <div className="pt-2 border-t border-[#1a3050]/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#5a7090]">
              {p.totalActions} actions · {p.rebalances} rebalances · {p.migrations} migrations
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
