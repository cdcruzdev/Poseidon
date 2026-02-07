"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import PositionCard, { Position } from "./PositionCard";

const POSITIONS_PER_PAGE = 3;

// Mock positions data
const mockPositions: Position[] = [
  {
    id: "1",
    token0: { symbol: "SOL", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
    token1: { symbol: "USDC", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
    dex: "meteora",
    poolType: "DLMM",
    isPrivate: true,
    value: 4521.50,
    pnl: 127.30,
    pnlPercent: 2.9,
    yield24h: 0.62,
    rangeStatus: "in-range",
    feesEarned: 23.45,
  },
  {
    id: "2",
    token0: { symbol: "JUP", logo: "https://assets.coingecko.com/coins/images/34188/small/jup.png" },
    token1: { symbol: "USDC", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
    dex: "orca",
    poolType: "Whirlpool",
    isPrivate: false,
    value: 1250.00,
    pnl: -45.20,
    pnlPercent: 3.5,
    yield24h: 1.24,
    rangeStatus: "near-edge",
    feesEarned: 8.12,
  },
  {
    id: "3",
    token0: { symbol: "BONK", logo: "https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg" },
    token1: { symbol: "SOL", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
    dex: "raydium",
    poolType: "CLMM",
    isPrivate: false,
    value: 892.15,
    pnl: 156.40,
    pnlPercent: 21.2,
    yield24h: 4.82,
    rangeStatus: "in-range",
    feesEarned: 67.23,
  },
  {
    id: "4",
    token0: { symbol: "WIF", logo: "https://assets.coingecko.com/coins/images/33566/small/wif.png" },
    token1: { symbol: "USDC", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
    dex: "meteora",
    poolType: "DLMM",
    isPrivate: true,
    value: 2340.00,
    pnl: -180.50,
    pnlPercent: 7.2,
    yield24h: 2.15,
    rangeStatus: "out-of-range",
    feesEarned: 12.80,
  },
  {
    id: "5",
    token0: { symbol: "RAY", logo: "https://assets.coingecko.com/coins/images/13928/small/ray.png" },
    token1: { symbol: "SOL", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
    dex: "raydium",
    poolType: "CLMM",
    isPrivate: false,
    value: 1100.00,
    pnl: 55.00,
    pnlPercent: 5.3,
    yield24h: 1.85,
    rangeStatus: "in-range",
    feesEarned: 18.90,
  },
  {
    id: "6",
    token0: { symbol: "PYTH", logo: "https://assets.coingecko.com/coins/images/31924/small/pyth.png" },
    token1: { symbol: "USDC", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
    dex: "orca",
    poolType: "Whirlpool",
    isPrivate: false,
    value: 780.25,
    pnl: 23.10,
    pnlPercent: 3.1,
    yield24h: 0.95,
    rangeStatus: "near-edge",
    feesEarned: 5.45,
  },
  {
    id: "7",
    token0: { symbol: "ORCA", logo: "https://assets.coingecko.com/coins/images/17547/small/orca.png" },
    token1: { symbol: "USDC", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
    dex: "orca",
    poolType: "Whirlpool",
    isPrivate: true,
    value: 3200.00,
    pnl: 245.60,
    pnlPercent: 8.3,
    yield24h: 1.42,
    rangeStatus: "in-range",
    feesEarned: 41.20,
  },
];

export default function MyPositions() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch - only render wallet-dependent UI after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = () => {
    setVisible(true);
  };
  
  const totalPages = Math.ceil(mockPositions.length / POSITIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSITIONS_PER_PAGE;
  const endIndex = startIndex + POSITIONS_PER_PAGE;
  const currentPositions = mockPositions.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentPage(page);
        setIsAnimating(false);
      }, 150);
    }
  };

  return (
    <section className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-xl tracking-wider text-white"
          style={{ fontFamily: "var(--font-bebas)" }}
        >
          MY POSITIONS
        </h2>
        {mounted && connected && (
          <span className="text-sm text-[#5a7090]">
            {mockPositions.length} positions
          </span>
        )}
      </div>

      {/* Loading State - Before Mount */}
      {!mounted && (
        <div className="bg-[#0d1926]/80 backdrop-blur-sm border border-[#1a3050] rounded-2xl p-12 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-[#1a3050] border-t-[#7ec8e8] rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State - Wallet Not Connected */}
      {mounted && !connected && (
        <div className="bg-[#0d1926]/80 backdrop-blur-sm border border-[#1a3050] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1a3050]/50 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5a7090"
              strokeWidth="1.5"
            >
              <path d="M19 7V4a1 1 0 00-1-1H5a2 2 0 00-2 2v14a2 2 0 002 2h13a1 1 0 001-1v-3" />
              <path d="M19 7h-8a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2z" />
              <circle cx="16" cy="12" r="1.5" fill="#5a7090" />
            </svg>
          </div>
          <h3 className="text-lg text-[#b8c8d8] mb-3" style={{ fontFamily: "var(--font-bebas)" }}>
            VIEW YOUR POSITIONS
          </h3>
          <p className="text-sm text-[#5a7090] mb-6">
            Connect your wallet to view and manage your liquidity positions
          </p>
          <button
            onClick={handleConnect}
            className="px-6 py-2.5 bg-[#fafaf9] text-[#09090b] font-medium rounded-lg hover:bg-[#e7e5e4] transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Position Cards - Only when connected */}
      {mounted && connected && (
        <>
          <div 
            className={`space-y-3 transition-opacity duration-150 ${
              isAnimating ? "opacity-0" : "opacity-100"
            }`}
          >
            {currentPositions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  currentPage === 1
                    ? "bg-[#1a3050]/50 text-[#3a5070] cursor-not-allowed"
                    : "bg-[#1a3050] text-[#7ec8e8] hover:bg-[#2a4060]"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-[#7ec8e8]/20 text-[#7ec8e8]"
                      : "text-[#5a7090] hover:bg-[#1a3050]"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  currentPage === totalPages
                    ? "bg-[#1a3050]/50 text-[#3a5070] cursor-not-allowed"
                    : "bg-[#1a3050] text-[#7ec8e8] hover:bg-[#2a4060]"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
