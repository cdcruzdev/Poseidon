"use client";

import { useState, useMemo } from "react";
import type { Pool } from "@/lib/api";
import AnimateHeight from "@/components/AnimateHeight";

interface ILCalculatorProps {
  pool: Pool | null;
  depositValueUSD: number;
}

// Calculate IL for a given price ratio change
function calculateIL(priceRatio: number): number {
  // IL formula: 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
  const sqrtRatio = Math.sqrt(priceRatio);
  return 2 * sqrtRatio / (1 + priceRatio) - 1;
}

const SCENARIOS = [
  { label: "-50%", ratio: 0.5, color: "#f87171" },
  { label: "-25%", ratio: 0.75, color: "#fbbf24" },
  { label: "+25%", ratio: 1.25, color: "#fbbf24" },
  { label: "+50%", ratio: 1.5, color: "#fbbf24" },
  { label: "+100%", ratio: 2.0, color: "#4ade80" },
  { label: "+200%", ratio: 3.0, color: "#4ade80" },
];

export default function ILCalculator({ pool, depositValueUSD }: ILCalculatorProps) {
  const [customPriceChange, setCustomPriceChange] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);

  const calculations = useMemo(() => {
    if (!pool || depositValueUSD <= 0) return null;

    const apr = pool.apr24h || pool.estimatedApr || 0;
    const dailyYield = depositValueUSD * (apr / 100 / 365);

    return SCENARIOS.map(scenario => {
      const il = calculateIL(scenario.ratio);
      const ilLoss = depositValueUSD * Math.abs(il);
      const daysToBreakeven = dailyYield > 0 ? ilLoss / dailyYield : Infinity;

      return {
        ...scenario,
        il: il * 100, // Convert to percentage
        ilLoss,
        daysToBreakeven: Math.round(daysToBreakeven),
        netPnL: (depositValueUSD * (scenario.ratio - 1) / 2) + (depositValueUSD * il), // Price PnL + IL
      };
    });
  }, [pool, depositValueUSD]);

  const customCalc = useMemo(() => {
    if (!customPriceChange || !pool || depositValueUSD <= 0) return null;

    const pctChange = parseFloat(customPriceChange);
    if (isNaN(pctChange)) return null;

    const ratio = 1 + pctChange / 100;
    if (ratio <= 0) return null;

    const il = calculateIL(ratio);
    const ilLoss = depositValueUSD * Math.abs(il);
    const apr = pool.apr24h || pool.estimatedApr || 0;
    const dailyYield = depositValueUSD * (apr / 100 / 365);
    const daysToBreakeven = dailyYield > 0 ? ilLoss / dailyYield : Infinity;

    return {
      ratio,
      il: il * 100,
      ilLoss,
      daysToBreakeven: Math.round(daysToBreakeven),
    };
  }, [customPriceChange, pool, depositValueUSD]);

  if (!pool || depositValueUSD <= 0) return null;

  return (
    <div className="bg-[#0d1d30]/80 rounded-xl border border-[#1a3050] overflow-hidden">
      <button
        onClick={() => setShowCalculator(!showCalculator)}
        className="w-full p-4 flex items-center justify-between hover:bg-[#1a3050]/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="font-semibold text-[#e0e8f0]">Impermanent Loss Calculator</span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[#5a7090] transition-transform ${showCalculator ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimateHeight open={showCalculator && !!calculations}>
        {calculations && <div className="p-4 border-t border-[#1a3050]">
          {/* Info Banner */}
          <div className="bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded-lg p-3 mb-4">
            <p className="text-xs text-[#fbbf24]">
              Impermanent loss occurs when the price ratio between paired tokens changes. 
              The larger the change, the greater the potential loss compared to just holding.
            </p>
          </div>

          {/* Scenarios Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {calculations?.map((calc) => (
              <div
                key={calc.label}
                className="bg-[#0a1520] rounded-lg p-3 border border-[#1a3050]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: calc.color }}>
                    {calc.label}
                  </span>
                  <span className="text-xs text-[#5a7090]">price</span>
                </div>
                <div className="text-lg font-bold text-[#f87171]">
                  {calc.il.toFixed(2)}%
                </div>
                <div className="text-xs text-[#5a7090] mt-1">
                  IL Loss: ${calc.ilLoss.toFixed(2)}
                </div>
                {calc.daysToBreakeven < Infinity && (
                  <div className="text-xs text-[#4ade80] mt-0.5">
                    {calc.daysToBreakeven}d to recover
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Custom Calculator */}
          <div className="bg-[#0a1520] rounded-lg p-4 border border-[#1a3050]">
            <div className="text-xs text-[#5a7090] mb-2">Custom Price Change</div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={customPriceChange}
                  onChange={(e) => setCustomPriceChange(e.target.value)}
                  placeholder="Enter % change"
                  className="w-full bg-[#0d1d30] border border-[#1a3050] rounded-lg px-3 py-2 text-sm text-[#e0e8f0] placeholder-[#5a7090] focus:border-[#7ec8e8] focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a7090] text-sm">%</span>
              </div>
              {customCalc && (
                <div className="flex items-center gap-3 px-3 bg-[#0d1d30] rounded-lg border border-[#1a3050]">
                  <div className="text-center">
                    <div className="text-xs text-[#5a7090]">IL</div>
                    <div className="text-sm font-bold text-[#f87171]">{customCalc.il.toFixed(2)}%</div>
                  </div>
                  <div className="w-px h-8 bg-[#1a3050]" />
                  <div className="text-center">
                    <div className="text-xs text-[#5a7090]">Loss</div>
                    <div className="text-sm font-bold text-[#fbbf24]">${customCalc.ilLoss.toFixed(2)}</div>
                  </div>
                  {customCalc.daysToBreakeven < Infinity && customCalc.daysToBreakeven > 0 && (
                    <>
                      <div className="w-px h-8 bg-[#1a3050]" />
                      <div className="text-center">
                        <div className="text-xs text-[#5a7090]">Recover</div>
                        <div className="text-sm font-bold text-[#4ade80]">{customCalc.daysToBreakeven}d</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Visual IL Curve */}
          <div className="mt-4">
            <div className="text-xs text-[#5a7090] mb-2">IL vs Price Change</div>
            <svg viewBox="0 0 200 80" className="w-full h-20">
              {/* Grid lines */}
              <line x1="20" y1="10" x2="20" y2="70" stroke="#1a3050" strokeWidth="1" />
              <line x1="20" y1="70" x2="190" y2="70" stroke="#1a3050" strokeWidth="1" />
              
              {/* IL Curve */}
              <path
                d="M 20,10 Q 60,15 100,35 Q 140,55 180,68"
                fill="none"
                stroke="#f87171"
                strokeWidth="2"
                opacity="0.8"
              />
              <path
                d="M 20,10 Q 60,15 100,35 Q 140,55 180,68 L 180,70 L 20,70 Z"
                fill="url(#ilGradient)"
              />
              <defs>
                <linearGradient id="ilGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f87171" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Labels */}
              <text x="100" y="78" textAnchor="middle" fill="#5a7090" fontSize="8">Price Change</text>
              <text x="10" y="40" textAnchor="middle" fill="#5a7090" fontSize="8" transform="rotate(-90, 10, 40)">IL %</text>
              
              {/* Point markers */}
              <circle cx="100" cy="35" r="3" fill="#fbbf24" />
              <text x="100" y="30" textAnchor="middle" fill="#fbbf24" fontSize="7">0% = 0% IL</text>
              
              <circle cx="60" cy="22" r="3" fill="#f87171" />
              <text x="60" y="17" textAnchor="middle" fill="#f87171" fontSize="7">-50% = 5.7%</text>
              
              <circle cx="140" cy="50" r="3" fill="#f87171" />
              <text x="155" y="45" textAnchor="middle" fill="#f87171" fontSize="7">+100% = 5.7%</text>
            </svg>
          </div>

          {/* Bottom note */}
          <div className="mt-3 text-[10px] text-[#5a7090] text-center">
            * Recovery time assumes constant yield and daily compounding
          </div>
        </div>}
      </AnimateHeight>
    </div>
  );
}
