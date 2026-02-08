"use client";

import { useState, useMemo, useEffect } from "react";
import type { Pool } from "@/lib/api";
import AnimateHeight from "@/components/AnimateHeight";

interface YieldSimulatorProps {
  pool: Pool | null;
  amountA: string;
  amountB: string;
  tokenAPrice?: number;
  tokenBPrice?: number;
}

const TIME_PERIODS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

export default function YieldSimulator({
  pool,
  amountA,
  amountB,
  tokenAPrice = 100, // Default SOL price
  tokenBPrice = 1,    // Default USDC price
}: YieldSimulatorProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(1); // 30D default
  const [animatedValues, setAnimatedValues] = useState({ earned: 0, total: 0 });
  const [showDetails, setShowDetails] = useState(false);

  const calculations = useMemo(() => {
    if (!pool) return null;

    const a = parseFloat(amountA) || 0;
    const b = parseFloat(amountB) || 0;
    const depositValueUSD = a * tokenAPrice + b * tokenBPrice;

    if (depositValueUSD === 0) return null;

    const apr = pool.apr24h || pool.estimatedApr || 0;
    const dailyRate = apr / 100 / 365;

    return TIME_PERIODS.map((period) => {
      // Simple yield (no compounding)
      const simpleYield = depositValueUSD * dailyRate * period.days;
      
      // Compound yield (daily compounding)
      const compoundYield = depositValueUSD * (Math.pow(1 + dailyRate, period.days) - 1);
      
      // Fee earnings estimate (based on volume)
      const dailyVolume = pool.volume24h || 0;
      const feeRate = pool.feeRate || 0.003;
      const lpShare = depositValueUSD / (pool.tvl + depositValueUSD);
      const dailyFees = dailyVolume * feeRate * lpShare;
      const totalFees = dailyFees * period.days;

      return {
        ...period,
        simpleYield,
        compoundYield,
        fees: totalFees,
        total: depositValueUSD + compoundYield,
        percentGain: (compoundYield / depositValueUSD) * 100,
      };
    });
  }, [pool, amountA, amountB, tokenAPrice, tokenBPrice]);

  // Animate values when they change
  useEffect(() => {
    if (!calculations) {
      setAnimatedValues({ earned: 0, total: 0 });
      return;
    }

    const target = calculations[selectedPeriod];
    const duration = 800;
    const startTime = Date.now();
    const startValues = { ...animatedValues };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedValues({
        earned: startValues.earned + (target.compoundYield - startValues.earned) * eased,
        total: startValues.total + (target.total - startValues.total) * eased,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculations, selectedPeriod]);

  if (!pool || !calculations) {
    return null;
  }

  const selectedCalc = calculations[selectedPeriod];
  const depositValue = (parseFloat(amountA) || 0) * tokenAPrice + (parseFloat(amountB) || 0) * tokenBPrice;

  if (depositValue === 0) return null;

  return (
    <div className="bg-[#0d1d30]/80 rounded-xl border border-[#1a3050] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1a3050]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#e0e8f0] flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7ec8e8" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            Yield Simulator
          </h3>
          <div className="flex bg-[#0a1520] rounded-lg p-0.5">
            {TIME_PERIODS.map((period, idx) => (
              <button
                key={period.label}
                onClick={() => setSelectedPeriod(idx)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  selectedPeriod === idx
                    ? "bg-[#7ec8e8] text-[#0a1520]"
                    : "text-[#5a7090] hover:text-[#8899aa]"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Estimated Earnings */}
          <div className="bg-[#7ec8e8]/5 rounded-xl p-4 border border-[#7ec8e8]/20">
            <div className="text-xs text-[#5a7090] mb-1">Est. Earnings</div>
            <div className="text-2xl font-bold text-[#7ec8e8]">
              ${animatedValues.earned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-[#4ade80] mt-1 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              +{selectedCalc.percentGain.toFixed(2)}%
            </div>
          </div>

          {/* Total Value */}
          <div className="bg-[#0a1520]/50 rounded-xl p-4 border border-[#1a3050]">
            <div className="text-xs text-[#5a7090] mb-1">Total Value</div>
            <div className="text-2xl font-bold text-[#e0e8f0]">
              ${animatedValues.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-[#5a7090] mt-1">
              After {TIME_PERIODS[selectedPeriod].days} days
            </div>
          </div>
        </div>

        {/* Visual Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-[#5a7090] mb-2">
            <span>Principal: ${depositValue.toLocaleString()}</span>
            <span>Yield: ${selectedCalc.compoundYield.toFixed(2)}</span>
          </div>
          <div className="h-3 bg-[#0a1520] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7ec8e8] to-[#4ade80] transition-all duration-700"
              style={{
                width: `${Math.min(100, (selectedCalc.total / (depositValue * 1.5)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Comparison Bars */}
        <div className="space-y-2">
          {calculations.map((calc, idx) => (
            <button
              key={calc.label}
              onClick={() => setSelectedPeriod(idx)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                selectedPeriod === idx
                  ? "bg-[#7ec8e8]/10"
                  : "hover:bg-[#1a3050]/30"
              }`}
            >
              <span className={`text-xs font-medium w-8 ${
                selectedPeriod === idx ? "text-[#7ec8e8]" : "text-[#5a7090]"
              }`}>
                {calc.label}
              </span>
              <div className="flex-1 h-2 bg-[#0a1520] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    selectedPeriod === idx
                      ? "bg-gradient-to-r from-[#7ec8e8] to-[#4ade80]"
                      : "bg-[#1a3050]"
                  }`}
                  style={{
                    width: `${Math.min(100, (calc.compoundYield / calculations[3].compoundYield) * 100)}%`,
                  }}
                />
              </div>
              <span className={`text-xs font-medium w-20 text-right ${
                selectedPeriod === idx ? "text-[#4ade80]" : "text-[#5a7090]"
              }`}>
                +${calc.compoundYield.toFixed(2)}
              </span>
            </button>
          ))}
        </div>

        {/* Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-4 pt-3 border-t border-[#1a3050] flex items-center justify-center gap-2 text-xs text-[#5a7090] hover:text-[#8899aa] transition-colors"
        >
          <span>{showDetails ? "Hide" : "Show"} Details</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${showDetails ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Detailed Breakdown */}
        <AnimateHeight open={showDetails}>
          <div className="mt-3 pt-3 border-t border-[#1a3050] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#5a7090]">24h Yield</span>
              <span className="text-[#8899aa]">{(pool.apr24h || pool.estimatedApr || 0).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5a7090]">Daily Rate</span>
              <span className="text-[#8899aa]">{((pool.apr24h || pool.estimatedApr || 0) / 365).toFixed(4)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5a7090]">Compounding</span>
              <span className="text-[#7ec8e8]">Daily</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5a7090]">Simple vs Compound</span>
              <span className="text-[#4ade80]">
                +${(selectedCalc.compoundYield - selectedCalc.simpleYield).toFixed(2)} extra
              </span>
            </div>
            <div className="mt-2 p-2 bg-[#0a1520] rounded-lg">
              <div className="text-[#5a7090] mb-1">Assumptions</div>
              <ul className="text-[#5a7090] space-y-0.5 text-[11px]">
                <li>• Yield remains constant (actual may vary)</li>
                <li>• Daily auto-compounding enabled</li>
                <li>• No impermanent loss considered</li>
                <li>• Fees reinvested automatically</li>
              </ul>
            </div>
          </div>
        </AnimateHeight>
      </div>
    </div>
  );
}
