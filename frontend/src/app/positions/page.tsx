import Navbar from "@/components/Navbar";
import PositionCard, { Position } from "@/components/PositionCard";
import StatsCard from "@/components/StatsCard";

// Mock positions data - using the shared Position type
const mockPositions: Position[] = [
  {
    id: "pos1",
    token0: { symbol: "SOL", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
    token1: { symbol: "USDC", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
    dex: "meteora",
    poolType: "DLMM",
    isPrivate: true,
    value: 12500,
    pnl: 850,
    pnlPercent: 7.3,
    yield24h: 0.85,
    rangeStatus: "in-range",
    feesEarned: 234.5,
  },
  {
    id: "pos2",
    token0: { symbol: "JUP", logo: "https://assets.coingecko.com/coins/images/34188/small/jup.png" },
    token1: { symbol: "USDC", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
    dex: "orca",
    poolType: "Whirlpool",
    isPrivate: false,
    value: 5200,
    pnl: -180,
    pnlPercent: 3.3,
    yield24h: 1.2,
    rangeStatus: "out-of-range",
    feesEarned: 89.2,
  },
  {
    id: "pos3",
    token0: { symbol: "WIF", logo: "https://assets.coingecko.com/coins/images/33566/small/wif.png" },
    token1: { symbol: "SOL", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
    dex: "raydium",
    poolType: "CLMM",
    isPrivate: false,
    value: 3100,
    pnl: 420,
    pnlPercent: 15.6,
    yield24h: 2.4,
    rangeStatus: "in-range",
    feesEarned: 156.8,
  },
];

export default function PositionsPage() {
  const totalValue = mockPositions.reduce((sum, p) => sum + p.value, 0);
  const totalPnl = mockPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalFees = mockPositions.reduce((sum, p) => sum + p.feesEarned, 0);
  const inRangeCount = mockPositions.filter(
    (p) => p.rangeStatus === "in-range"
  ).length;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl tracking-wider mb-2" style={{ fontFamily: 'var(--font-bebas)' }}>MY POSITIONS</h1>
            <p className="text-[#5a7090]">
              Manage your LP positions across all DEXs
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard
              title="Total Value"
              value={`$${totalValue.toLocaleString()}`}
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
            <StatsCard
              title="Total PnL"
              value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString()}`}
              changePositive={totalPnl >= 0}
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              }
            />
            <StatsCard
              title="Fees Earned"
              value={`$${totalFees.toLocaleString()}`}
              changePositive={true}
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                  <path d="M12 6v2m0 8v2" />
                </svg>
              }
            />
            <StatsCard
              title="In Range"
              value={`${inRangeCount}/${mockPositions.length}`}
              change={`${((inRangeCount / mockPositions.length) * 100).toFixed(0)}% healthy`}
              changePositive={true}
              icon={
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
          </div>

          {/* Auto-Rebalance Banner */}
          <div className="mb-8 p-4 bg-[#7ec8e8]/5 border border-[#7ec8e8]/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#7ec8e8]/10 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7ec8e8"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#e0e8f0]">Auto-Rebalance Active</h3>
                <p className="text-sm text-[#5a7090]">
                  The agent will automatically rebalance positions when they go out of range
                </p>
              </div>
            </div>
            <button className="px-4 py-2 rounded-lg border border-[#1a3050] text-[#8899aa] text-sm hover:bg-[#1a3050] transition-colors">Configure</button>
          </div>

          {/* Positions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {mockPositions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>

          {/* Empty State */}
          {mockPositions.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#1a3050] flex items-center justify-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 32 32"
                  fill="none"
                  className="text-[#5a7090]"
                >
                  <rect x="4" y="14" width="5" height="14" rx="2.5" fill="currentColor"/>
                  <rect x="13.5" y="6" width="5" height="22" rx="2.5" fill="currentColor"/>
                  <rect x="23" y="10" width="5" height="18" rx="2.5" fill="currentColor"/>
                  <path d="M6.5 14C6.5 10 10 6 16 6C22 6 25.5 10 25.5 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[#e0e8f0]">No Positions Yet</h3>
              <p className="text-[#5a7090] mb-6">
                Start by depositing into a pool
              </p>
              <button className="px-6 py-3 rounded-xl bg-[#7ec8e8] text-[#0a1520] font-semibold hover:bg-[#9dd8f0] transition-colors">Explore Pools</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
