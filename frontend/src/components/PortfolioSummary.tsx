"use client";

import { Position } from "./PositionCard";

interface PortfolioSummaryProps {
  positions: Position[];
}

export default function PortfolioSummary({ positions }: PortfolioSummaryProps) {
  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalFees = positions.reduce((sum, p) => sum + p.feesEarned, 0);
  const avgYield = positions.length > 0
    ? positions.reduce((sum, p) => sum + p.yield24h, 0) / positions.length
    : 0;
  const inRange = positions.filter((p) => p.rangeStatus === "in-range").length;
  const pnlPercent = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;
  const pnlColor = totalPnl >= 0 ? "#4ade80" : "#f87171";

  const stats = [
    {
      label: "Total Value",
      value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: null,
    },
    {
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,
      sub: `${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%`,
      color: pnlColor,
    },
    {
      label: "Fees Earned",
      value: `$${totalFees.toFixed(2)}`,
      sub: null,
    },
    {
      label: "Avg 24h Yield",
      value: `${avgYield.toFixed(2)}%`,
      sub: `${inRange}/${positions.length} in range`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] p-4"
        >
          <p className="text-xs text-[#5a7090] mb-1">{stat.label}</p>
          <p
            className="text-lg font-semibold font-mono"
            style={{ color: stat.color || "#e0e8f0" }}
          >
            {stat.value}
          </p>
          {stat.sub && (
            <p
              className="text-xs mt-0.5"
              style={{ color: stat.color || "#8899aa" }}
            >
              {stat.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
