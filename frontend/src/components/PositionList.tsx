"use client";

import { useState, useMemo } from "react";
import PositionCard from "@/components/PositionCard";
import type { Position } from "@/types/position";

interface PositionListProps {
  positions: Position[];
  loading?: boolean;
  emptyMessage?: string;
  perPage?: number;
  onClosePosition?: (id: string) => void;
  closingId?: string | null;
}

export default function PositionList({ positions, loading, emptyMessage = "No positions yet.", perPage = 3, onClosePosition, closingId }: PositionListProps) {
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [posPage, setPosPage] = useState(0);
  const [sortBy, setSortBy] = useState<"pnl" | "apy" | "value">("value");

  const sorted = useMemo(() => {
    const filtered = positions;
    return [...filtered].sort((a, b) => {
      if (sortBy === "apy") return parseFloat(b.apy) - parseFloat(a.apy);
      if (sortBy === "pnl") return parseFloat(b.pnl.replace(/[,$+]/g, "")) - parseFloat(a.pnl.replace(/[,$+]/g, ""));
      return parseFloat(b.current.replace(/[,$]/g, "")) - parseFloat(a.current.replace(/[,$]/g, ""));
    });
  }, [positions, filterDex, sortBy]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const safePage = Math.min(posPage, Math.max(totalPages - 1, 0));
  const pagePositions = sorted.slice(safePage * perPage, (safePage + 1) * perPage);

  if (loading) {
    return (
      <div className="bg-[#0d1926]/80 backdrop-blur-sm border border-[#1a3050] rounded-2xl p-12 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-[#1a3050] border-t-[#7ec8e8] rounded-full animate-spin" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-[#0d1926]/80 backdrop-blur-sm border border-[#1a3050] rounded-2xl p-12 text-center">
        <p className="text-sm text-[#8899aa]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl tracking-wider text-white" style={{ fontFamily: "var(--font-bebas)" }}>
          MY POSITIONS ({sorted.length})
        </h2>
        <div className="flex items-center gap-1">
          {(["value", "apy", "pnl"] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                sortBy === opt
                  ? "bg-[#7ec8e8]/15 text-[#7ec8e8] border border-[#7ec8e8]/30"
                  : "bg-[#1a3050]/50 text-[#5a7090] border border-transparent hover:text-[#8899aa]"
              }`}
            >
              {opt === "value" ? "Value" : opt === "apy" ? "Yield" : "P&L"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {pagePositions.map((pos) => (
          <PositionCard
            key={pos.id}
            position={pos}
            expanded={expandedPosition === pos.id}
            onToggle={() => setExpandedPosition(expandedPosition === pos.id ? null : pos.id)}
            onClose={onClosePosition}
            closing={closingId === pos.id}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPosPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#1a3050] text-[#8899aa] hover:text-[#e0e8f0] hover:border-[#7ec8e8] transition-colors disabled:opacity-30 disabled:hover:text-[#8899aa] disabled:hover:border-[#1a3050] cursor-pointer disabled:cursor-default"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPosPage(i)}
              className={`w-8 h-8 text-xs rounded-lg border transition-colors cursor-pointer ${
                i === safePage
                  ? "border-[#7ec8e8] text-[#7ec8e8] bg-[#7ec8e8]/10"
                  : "border-[#1a3050] text-[#5a7090] hover:text-[#e0e8f0] hover:border-[#7ec8e8]"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPosPage(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage === totalPages - 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#1a3050] text-[#8899aa] hover:text-[#e0e8f0] hover:border-[#7ec8e8] transition-colors disabled:opacity-30 disabled:hover:text-[#8899aa] disabled:hover:border-[#1a3050] cursor-pointer disabled:cursor-default"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
