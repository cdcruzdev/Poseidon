"use client";

export interface Position {
  id: string;
  token0: { symbol: string; logo: string };
  token1: { symbol: string; logo: string };
  dex: "meteora" | "orca" | "raydium";
  poolType: string;
  isPrivate: boolean;
  value: number;
  pnl: number;
  pnlPercent: number;
  yield24h: number;
  rangeStatus: "in-range" | "near-edge" | "out-of-range";
  feesEarned: number;
}

const dexLogos: Record<string, string> = {
  meteora: "/meteora-logo.svg",
  orca: "/orca-logo.png",
  raydium: "/raydium-logo.ico",
};

const dexNames: Record<string, string> = {
  meteora: "Meteora",
  orca: "Orca",
  raydium: "Raydium",
};

const rangeColors: Record<string, string> = {
  "in-range": "#4ade80",
  "near-edge": "#fbbf24",
  "out-of-range": "#f87171",
};

const rangeLabels: Record<string, string> = {
  "in-range": "In Range",
  "near-edge": "Near Edge",
  "out-of-range": "Out of Range",
};

export default function PositionCard({ position }: { position: Position }) {
  const pnlColor = position.pnl >= 0 ? "#4ade80" : "#f87171";
  const pnlSign = position.pnl >= 0 ? "+" : "";

  return (
    <div className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <img
              src={position.token0.logo}
              alt={position.token0.symbol}
              className="w-8 h-8 rounded-full border-2 border-[#0a1520]"
            />
            <img
              src={position.token1.logo}
              alt={position.token1.symbol}
              className="w-8 h-8 rounded-full border-2 border-[#0a1520]"
            />
          </div>
          <div>
            <h4 className="font-semibold text-[#e0e8f0]">
              {position.token0.symbol} / {position.token1.symbol}
            </h4>
            <div className="flex items-center gap-2 text-xs">
              <img
                src={dexLogos[position.dex]}
                alt={dexNames[position.dex]}
                className="w-4 h-4"
              />
              <span className="text-[#5a7090]">{dexNames[position.dex]}</span>
              <span className="px-1.5 py-0.5 rounded bg-[#1a3050] text-[#7ec8e8]">
                {position.poolType}
              </span>
              {position.isPrivate && (
                <span className="px-1.5 py-0.5 rounded bg-[#7ec8e8]/10 text-[#7ec8e8]">
                  Private
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-[#e0e8f0]">
            ${position.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-sm" style={{ color: pnlColor }}>
            {pnlSign}${Math.abs(position.pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })} ({pnlSign}{position.pnlPercent}%)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#1a3050]">
        <div>
          <div className="text-xs text-[#5a7090] mb-1">24h Yield</div>
          <div className="text-sm font-semibold text-[#7ec8e8]">{position.yield24h}%</div>
        </div>
        <div>
          <div className="text-xs text-[#5a7090] mb-1">Range</div>
          <div
            className="text-sm font-semibold"
            style={{ color: rangeColors[position.rangeStatus] }}
          >
            {rangeLabels[position.rangeStatus]}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#5a7090] mb-1">Fees Earned</div>
          <div className="text-sm font-semibold text-[#e0e8f0]">
            ${position.feesEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-3 mt-3 border-t border-[#1a3050]">
        <button className="flex-1 py-2 px-3 rounded-lg bg-[#7ec8e8]/10 text-[#7ec8e8] text-sm font-medium hover:bg-[#7ec8e8]/20 transition-colors">
          Claim Fees
        </button>
        <button className="flex-1 py-2 px-3 rounded-lg bg-[#1a3050] text-[#8899aa] text-sm font-medium hover:bg-[#2a4060] transition-colors">
          Close Position
        </button>
      </div>
    </div>
  );
}
