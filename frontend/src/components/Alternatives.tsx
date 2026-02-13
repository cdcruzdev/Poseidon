"use client";

import { useState } from "react";
import type { Pool } from "@/lib/api";
import PoolResult from "@/components/PoolResult";
import AnimateHeight from "@/components/AnimateHeight";

interface AlternativesProps {
  pools: Pool[];
  selectedPool: Pool | null;
  bestPool?: Pool | null;
  onSelectPool: (pool: Pool) => void;
  loading?: boolean;
}

type SortMode = "yield" | "tvl";

export default function Alternatives({
  pools,
  selectedPool,
  bestPool,
  onSelectPool,
  loading = false,
}: AlternativesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>("tvl");

  // Filter out the selected pool, require $100K+ TVL, max 5
  const alternativePools = pools
    .filter((p) => !selectedPool || p.address !== selectedPool.address)
    .filter((p) => p.tvl >= 100_000)
    .sort((a, b) => {
      if (sortBy === "tvl") return b.tvl - a.tvl;
      const yieldA = a.yield24h ?? (a.apr24h || a.estimatedApr || 0) / 365;
      const yieldB = b.yield24h ?? (b.apr24h || b.estimatedApr || 0) / 365;
      return yieldB - yieldA;
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div className="border-b border-[#1a3050] pb-4">
        <div className="flex items-center justify-between py-2">
          <div className="h-4 w-32 bg-[#2a4060] rounded animate-pulse" />
          <div className="h-4 w-4 bg-[#2a4060] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (alternativePools.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[#1a3050] pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-left hover:bg-[#1a3050] rounded-lg transition-colors text-sm"
      >
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-[#5a7090]"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="text-sm font-medium text-[#8899aa]">
            Alternatives ({alternativePools.length})
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[#5a7090] transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimateHeight open={isOpen}>
        <div className="flex items-center gap-2 mt-2 mb-3 px-1">
          <span className="text-[10px] text-[#5a7090] uppercase tracking-wider">Sort by</span>
          <button
            onClick={() => setSortBy("tvl")}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              sortBy === "tvl"
                ? "bg-[#7ec8e8]/15 text-[#7ec8e8] border border-[#7ec8e8]/30"
                : "bg-[#1a3050] text-[#5a7090] border border-transparent hover:text-[#8899aa]"
            }`}
          >
            TVL
          </button>
          <button
            onClick={() => setSortBy("yield")}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
              sortBy === "yield"
                ? "bg-[#7ec8e8]/15 text-[#7ec8e8] border border-[#7ec8e8]/30"
                : "bg-[#1a3050] text-[#5a7090] border border-transparent hover:text-[#8899aa]"
            }`}
          >
            24h Yield
          </button>
        </div>
        <div className="space-y-2">
          {alternativePools.map((pool) => (
            <PoolResult
              key={pool.address}
              pool={pool}
              compact
              selected={false}
              onClick={() => onSelectPool(pool)}
              sortBy={sortBy}
              isBest={!!bestPool && pool.address === bestPool.address}
            />
          ))}
        </div>
      </AnimateHeight>
    </div>
  );
}
