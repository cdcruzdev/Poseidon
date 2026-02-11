"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/api";

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

interface ApiPerformance {
  uptime: number;
  uptimeFormatted: string;
  positionsMonitored: number;
  rebalancesExecuted: number;
  feesCollected: { deposit: number; performance: number };
  totalValueManaged: number;
}

const defaultPeriod: PerformancePeriod = {
  label: "All Time",
  totalActions: 0,
  rebalances: 0,
  migrations: 0,
  gasSpent: "0 SOL",
  feesEarned: "$0.00",
  netProfit: "$0.00",
  ilSaved: "$0.00",
  avgConfidence: 0,
  successRate: 0,
  uptimePercent: 0,
};

function mapApiToPerformance(api: ApiPerformance): PerformancePeriod {
  const totalFees = (api.feesCollected?.deposit || 0) + (api.feesCollected?.performance || 0);
  const uptimePct = api.uptime > 0 ? Math.min(100, (api.uptime / (api.uptime + 1)) * 100) : 0;
  return {
    label: "All Time",
    totalActions: api.rebalancesExecuted + api.positionsMonitored,
    rebalances: api.rebalancesExecuted,
    migrations: 0,
    gasSpent: "0 SOL",
    feesEarned: `$${totalFees.toFixed(2)}`,
    netProfit: `$${totalFees.toFixed(2)}`,
    ilSaved: "$0.00",
    avgConfidence: 0,
    successRate: 0,
    uptimePercent: Math.round(uptimePct * 10) / 10,
  };
}

export default function AgentPerformance() {
  const [period, setPeriod] = useState<PerformancePeriod>(defaultPeriod);
  const [loading, setLoading] = useState(true);
  const [uptimeLabel, setUptimeLabel] = useState("");

  useEffect(() => {
    async function fetchPerformance() {
      try {
        const res = await fetch(`${API_BASE}/api/agent/performance`);
        const json = await res.json();
        if (json.success && json.data) {
          setPeriod(mapApiToPerformance(json.data));
          setUptimeLabel(json.data.uptimeFormatted || "");
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchPerformance();
    const interval = setInterval(fetchPerformance, 30000);
    return () => clearInterval(interval);
  }, []);

  const p = period;

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

        <div className="flex items-center gap-2">
          {uptimeLabel && (
            <span className="text-xs text-[#5a7090]">Uptime: {uptimeLabel}</span>
          )}
          <span className="text-xs text-[#8899aa] bg-[#1a3050] px-2.5 py-1 rounded-md">
            {p.label}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="w-5 h-5 border-2 border-[#1a3050] border-t-[#7ec8e8] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#5a7090]">Loading performance...</p>
        </div>
      ) : (
        <>
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
                  {p.totalActions} actions -- {p.rebalances} rebalances -- {p.migrations} migrations
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
