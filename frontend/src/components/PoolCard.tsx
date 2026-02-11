"use client";

interface PoolCardProps {
  pool: {
    address: string;
    tokenA: string;
    tokenB: string;
    dex: "meteora" | "orca" | "raydium";
    tvl: number;
    apr: number;
    volume24h: number;
    feeRate: number;
  };
  onDeposit?: () => void;
}

const dexLogos: Record<string, { name: string; color: string }> = {
  meteora: { name: "Meteora", color: "#E4B740" },
  orca: { name: "Orca", color: "#00A3FF" },
  raydium: { name: "Raydium", color: "#5AC4BE" },
};

// Token colors
const tokenColors: Record<string, string> = {
  SOL: "#9945FF",
  USDC: "#2775CA",
  USDT: "#26A17B",
  RAY: "#5AC4BE",
  ORCA: "#FF7A00",
  JUP: "#5DADE2",
  BONK: "#F5A623",
  WIF: "#A855F7",
};

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

export default function PoolCard({ pool, onDeposit }: PoolCardProps) {
  const dex = dexLogos[pool.dex];

  // Handle invalid APR values
  const displayApr = isNaN(pool.apr) || !isFinite(pool.apr) ? 0 : pool.apr;

  const getTokenColor = (symbol: string) => tokenColors[symbol] || "#7ec8e8";

  return (
    <div className="bg-[#0a1520] border border-[#1a3050] rounded-xl p-6 hover:border-[#2a4060] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Token pair icons */}
          <div className="flex -space-x-2">
            <div
              className="w-10 h-10 rounded-full border-2 border-[#0a1520] flex items-center justify-center text-xs font-bold text-[#0a1520]"
              style={{ backgroundColor: getTokenColor(pool.tokenA) }}
            >
              {pool.tokenA.slice(0, 2)}
            </div>
            <div
              className="w-10 h-10 rounded-full border-2 border-[#0a1520] flex items-center justify-center text-xs font-bold text-[#0a1520]"
              style={{ backgroundColor: getTokenColor(pool.tokenB) }}
            >
              {pool.tokenB.slice(0, 2)}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {pool.tokenA}/{pool.tokenB}
            </h3>
            <div
              className="text-xs font-medium px-2 py-0.5 rounded-md inline-block"
              style={{ backgroundColor: `${dex.color}20`, color: dex.color }}
            >
              {dex.name}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-[#5a7090] text-sm mb-1">TVL</p>
          <p className="font-semibold text-lg">{formatNumber(pool.tvl)}</p>
        </div>
        <div>
          <p className="text-[#5a7090] text-sm mb-1">Est. 24h Yield</p>
          <p className={`font-semibold text-lg ${displayApr > 0 ? 'text-[#4ade80]' : 'text-[#5a7090]'}`}>
            {displayApr > 0 ? `${displayApr.toFixed(2)}%` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-[#5a7090] text-sm mb-1">24h Volume</p>
          <p className="font-medium">{formatNumber(pool.volume24h)}</p>
        </div>
        <div>
          <p className="text-[#5a7090] text-sm mb-1">Fee</p>
          <p className="font-medium">{(pool.feeRate * 100).toFixed(2)}%</p>
        </div>
      </div>

      {/* Address (truncated) */}
      <div className="mb-4 p-2 bg-[#1a3050] rounded-lg text-xs font-mono text-[#5a7090] truncate">
        {pool.address}
      </div>

      {/* Action Button */}
      <button
        onClick={onDeposit}
        className="btn btn-primary w-full"
      >
        Deposit
      </button>
    </div>
  );
}
