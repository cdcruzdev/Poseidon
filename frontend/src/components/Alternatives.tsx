"use client";

import { useState } from "react";
import type { Pool } from "@/lib/api";
import PoolResult from "@/components/PoolResult";
import AnimateHeight from "@/components/AnimateHeight";

interface AlternativesProps {
  pools: Pool[];
  selectedPool: Pool | null;
  onSelectPool: (pool: Pool) => void;
  loading?: boolean;
}

export default function Alternatives({
  pools,
  selectedPool,
  onSelectPool,
  loading = false,
}: AlternativesProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter out the selected pool from alternatives
  const alternativePools = pools.filter(
    (p) => !selectedPool || p.address !== selectedPool.address
  );

  if (loading) {
    return (
      <div className="border-t border-[#27272a] pt-4">
        <div className="flex items-center justify-between px-1 py-2">
          <div className="h-4 w-32 bg-[#3f3f46] rounded animate-pulse" />
          <div className="h-4 w-4 bg-[#3f3f46] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (alternativePools.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-[#27272a] pt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-1 py-2 text-left hover:bg-[#27272a] rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-[#71717a]"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="text-sm font-medium text-[#a1a1aa]">
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
          className={`text-[#71717a] transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimateHeight open={isOpen}>
        <div className="mt-2 space-y-2">
          {alternativePools.map((pool) => (
            <PoolResult
              key={pool.address}
              pool={pool}
              compact
              selected={false}
              onClick={() => onSelectPool(pool)}
            />
          ))}
        </div>
      </AnimateHeight>
    </div>
  );
}
