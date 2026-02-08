"use client";

import { useMemo } from "react";
import type { Pool } from "@/lib/api";
import RiskBadge from "@/components/RiskBadge";
import APRSparkline, { generateMockAPRHistory } from "@/components/APRSparkline";
/* eslint-disable @next/next/no-img-element */

interface PoolResultProps {
  pool: Pool | null;
  loading?: boolean;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  showSparkline?: boolean;
}

// DEX brand colors - muted to fit Poseidon palette
const dexColors: Record<string, string> = {
  meteora: "#7ec8e8", // cyan to match our accent
  orca: "#7ec8e8",
  raydium: "#7ec8e8",
};

// DEX logo URLs - local files
const dexLogoUrls: Record<string, string> = {
  meteora: "/meteora-logo.svg",
  orca: "/orca-logo.png",
  raydium: "/raydium-logo.ico",
};

const dexLogos: Record<string, string> = {
  meteora: "M",
  orca: "O",
  raydium: "R",
};

export default function PoolResult({
  pool,
  loading = false,
  selected = false,
  onClick,
  compact = false,
  showSparkline = true,
}: PoolResultProps) {
  // Generate mock APR history for sparkline
  const aprHistory = useMemo(() => {
    if (!pool) return [];
    return generateMockAPRHistory(pool.apr24h || pool.estimatedApr || 0, 7);
  }, [pool]);
  if (loading) {
    return (
      <div className="bg-[#0d1d30]/80 rounded-xl p-4 border border-[#1a3050] animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1a3050]" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-[#1a3050] rounded mb-2" />
            <div className="h-3 w-32 bg-[#1a3050] rounded" />
          </div>
          <div className="text-right">
            <div className="h-5 w-16 bg-[#1a3050] rounded mb-1" />
            <div className="h-3 w-12 bg-[#1a3050] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="bg-[#0d1d30]/80 rounded-xl p-4 border border-[#1a3050]">
        <div className="flex items-center justify-center gap-2 text-[#5a7090]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-sm">Select tokens to find pools</span>
        </div>
      </div>
    );
  }

  const dexColor = dexColors[pool.dex] || "#5eead4";
  const apr = pool.apr24h || pool.estimatedApr || 0;
  const tvlFormatted = pool.tvl >= 1_000_000
    ? `$${(pool.tvl / 1_000_000).toFixed(1)}M`
    : `$${(pool.tvl / 1_000).toFixed(0)}K`;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
          selected
            ? "bg-[#7ec8e8]/10 border border-[#7ec8e8]/50"
            : "bg-[#0d1d30] border border-transparent hover:border-[#1a3050]"
        }`}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-[#1a3050]"
          style={{ color: dexColor }}
        >
          {dexLogoUrls[pool.dex] ? (
            <img
              src={dexLogoUrls[pool.dex]}
              alt={pool.dex}
              width={20}
              height={20}
              className="rounded"
            />
          ) : (
            dexLogos[pool.dex]
          )}
        </div>
        <div className="flex-1 text-left">
          <span className="font-medium capitalize text-[#e0e8f0]">{pool.dex}</span>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#5a7090]">24h Yield</span>
            <span className="text-sm font-semibold text-[#7ec8e8]">{apr.toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#5a7090]">TVL</span>
            <span className="text-xs text-[#5a7090]">{tvlFormatted}</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-[#0d1d30]/80 rounded-xl p-4 border transition-all ${
        selected
          ? "border-[#7ec8e8]/50 bg-[#7ec8e8]/5"
          : "border-[#1a3050] hover:border-[#2a4060]"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      {/* Best Pool Badge */}
      {selected && (
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-2 h-2 rounded-full bg-[#7ec8e8] animate-pulse" />
          <span className="text-xs font-semibold text-[#7ec8e8] uppercase tracking-wide">
            Best Pool Found
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* DEX Logo */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg bg-[#1a3050]">
          {dexLogoUrls[pool.dex] ? (
            <img
              src={dexLogoUrls[pool.dex]}
              alt={pool.dex}
              width={28}
              height={28}
              className="rounded"
            />
          ) : (
            <span style={{ color: dexColor }}>{dexLogos[pool.dex]}</span>
          )}
        </div>

        {/* Pool Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold capitalize text-[#e0e8f0]">{pool.dex}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-[#1a3050] text-[#7ec8e8]">
              DLMM
            </span>
            <RiskBadge pool={pool} size="sm" />
          </div>
          <div className="text-sm text-[#5a7090] mt-0.5">
            Fee: {(pool.feeRate * 100).toFixed(2)}% | TVL: {tvlFormatted}
          </div>
        </div>

        {/* APR with Sparkline */}
        <div className="text-right flex flex-col items-end gap-1">
          <div className="text-xl font-bold text-[#7ec8e8]">{apr.toFixed(2)}%</div>
          <div className="flex items-center gap-2">
            {showSparkline && aprHistory.length > 0 && (
              <APRSparkline data={aprHistory} width={60} height={20} showTrend={false} />
            )}
            <span className="text-xs text-[#5a7090]">24h Yield</span>
          </div>
        </div>
      </div>
    </div>
  );
}
