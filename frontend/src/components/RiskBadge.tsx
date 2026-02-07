"use client";

import { useMemo } from "react";
import type { Pool } from "@/lib/api";

interface RiskBadgeProps {
  pool: Pool;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
}

type RiskLevel = "conservative" | "moderate" | "aggressive" | "degen";

interface RiskProfile {
  level: RiskLevel;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
  score: number;
}

const RISK_PROFILES: Record<RiskLevel, Omit<RiskProfile, "score">> = {
  conservative: {
    level: "conservative",
    label: "Conservative",
    color: "#4ade80",
    bgColor: "rgba(74, 222, 128, 0.1)",
    borderColor: "rgba(74, 222, 128, 0.3)",
    icon: "🛡️",
    description: "Low risk, stable pairs, high TVL",
  },
  moderate: {
    level: "moderate",
    label: "Moderate",
    color: "#7ec8e8",
    bgColor: "rgba(126, 200, 232, 0.1)",
    borderColor: "rgba(126, 200, 232, 0.3)",
    icon: "⚖️",
    description: "Balanced risk-reward profile",
  },
  aggressive: {
    level: "aggressive",
    label: "Aggressive",
    color: "#fbbf24",
    bgColor: "rgba(251, 191, 36, 0.1)",
    borderColor: "rgba(251, 191, 36, 0.3)",
    icon: "⚡",
    description: "Higher volatility, higher potential returns",
  },
  degen: {
    level: "degen",
    label: "Degen",
    color: "#f87171",
    bgColor: "rgba(248, 113, 113, 0.1)",
    borderColor: "rgba(248, 113, 113, 0.3)",
    icon: "🔥",
    description: "High risk, new/volatile tokens",
  },
};

// Stablecoin symbols
const STABLECOINS = ["USDC", "USDT", "USDS", "DAI", "PYUSD", "USDG", "USH", "UXD"];

// Major/established tokens
const MAJOR_TOKENS = ["SOL", "BTC", "ETH", "WBTC", "cbBTC", "JitoSOL", "mSOL", "bSOL", "JupSOL", "JLP", "JUP", "BONK", "WIF"];

export function calculateRiskScore(pool: Pool): RiskProfile {
  let score = 50; // Start neutral

  // TVL factor (higher = safer)
  if (pool.tvl >= 10_000_000) score -= 15;      // $10M+ = very safe
  else if (pool.tvl >= 1_000_000) score -= 10;  // $1M+ = safe
  else if (pool.tvl >= 100_000) score -= 5;     // $100K+ = okay
  else if (pool.tvl < 10_000) score += 20;      // <$10K = risky

  // Token pair factor
  const tokenA = (pool.tokenA?.symbol || "").toUpperCase();
  const tokenB = (pool.tokenB?.symbol || "").toUpperCase();
  
  const isStableA = STABLECOINS.some(s => tokenA.includes(s));
  const isStableB = STABLECOINS.some(s => tokenB.includes(s));
  const isMajorA = MAJOR_TOKENS.some(t => tokenA.includes(t));
  const isMajorB = MAJOR_TOKENS.some(t => tokenB.includes(t));

  if (isStableA && isStableB) {
    score -= 20; // Stable-stable = very safe
  } else if (isStableA || isStableB) {
    if (isMajorA || isMajorB) {
      score -= 10; // Major + stable = safe
    }
  } else if (isMajorA && isMajorB) {
    score -= 5; // Major-major = okay
  } else if (!isMajorA && !isMajorB) {
    score += 20; // Unknown tokens = risky
  }

  // APR factor (extremely high APR = usually risky)
  const apr = pool.apr24h || pool.estimatedApr || 0;
  if (apr > 500) score += 25;      // >500% = very risky
  else if (apr > 200) score += 15; // >200% = risky
  else if (apr > 100) score += 5;  // >100% = slightly risky
  else if (apr < 10) score -= 5;   // <10% = usually stable

  // Volume factor (healthy volume = good)
  const volumeRatio = pool.volume24h ? pool.volume24h / pool.tvl : 0;
  if (volumeRatio > 2) score -= 5;      // Active trading
  else if (volumeRatio < 0.01) score += 10; // Dead pool

  // Fee rate factor
  if (pool.feeRate > 0.01) score += 5;  // High fee = volatile pair
  else if (pool.feeRate < 0.001) score -= 5; // Low fee = stable

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let level: RiskLevel;
  if (score <= 25) level = "conservative";
  else if (score <= 50) level = "moderate";
  else if (score <= 75) level = "aggressive";
  else level = "degen";

  return {
    ...RISK_PROFILES[level],
    score,
  };
}

// Helper to get token symbol from Pool
function getTokenSymbol(token: { symbol: string; mint: string } | undefined): string {
  if (!token) return "";
  return (token.symbol || "").toUpperCase();
}

export default function RiskBadge({ pool, showTooltip = true, size = "sm" }: RiskBadgeProps) {
  const risk = useMemo(() => calculateRiskScore(pool), [pool]);
  
  // Get token symbols for tooltip display
  const tokenA = getTokenSymbol(pool.tokenA);
  const tokenB = getTokenSymbol(pool.tokenB);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-1.5 text-base gap-2",
  };

  return (
    <div className="relative group">
      <div
        className={`inline-flex items-center rounded-md font-medium transition-all ${sizeClasses[size]}`}
        style={{
          backgroundColor: risk.bgColor,
          borderWidth: "1px",
          borderColor: risk.borderColor,
          color: risk.color,
        }}
      >
        <span>{risk.icon}</span>
        <span>{risk.label}</span>
      </div>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
          <div className="bg-[#0a1520] border border-[#1a3050] rounded-xl p-3 shadow-xl">
            {/* Risk Score Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#5a7090]">Risk Score</span>
                <span style={{ color: risk.color }}>{risk.score}/100</span>
              </div>
              <div className="h-2 bg-[#1a3050] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${risk.score}%`,
                    backgroundColor: risk.color,
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-[#8899aa] mb-3">{risk.description}</p>

            {/* Factors */}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#5a7090]">TVL</span>
                <span className={pool.tvl >= 1_000_000 ? "text-[#4ade80]" : "text-[#fbbf24]"}>
                  {pool.tvl >= 10_000_000 ? "Very High" : pool.tvl >= 1_000_000 ? "High" : pool.tvl >= 100_000 ? "Medium" : "Low"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5a7090]">APR</span>
                <span className={(pool.apr24h || 0) > 100 ? "text-[#fbbf24]" : "text-[#4ade80]"}>
                  {(pool.apr24h || pool.estimatedApr || 0).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5a7090]">Pair Type</span>
                <span className="text-[#8899aa]">
                  {STABLECOINS.some(s => tokenA.includes(s) && tokenB.includes(s))
                    ? "Stable/Stable"
                    : STABLECOINS.some(s => tokenA.includes(s) || tokenB.includes(s))
                    ? "Major/Stable"
                    : "Volatile"}
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[#0a1520] border-r border-b border-[#1a3050]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
