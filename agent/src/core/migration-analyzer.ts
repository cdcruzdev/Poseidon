import Decimal from 'decimal.js';
import { PoolInfo } from '../types/index.js';

/**
 * Result of a migration profitability analysis
 */
export interface MigrationAnalysis {
  /** Whether migration is recommended */
  profitable: boolean;
  /** Net yield improvement per day in USD after amortized costs */
  netBenefitPerDay: number;
  /** Days until migration costs are recovered */
  breakEvenDays: number;
  /** Human-readable explanation */
  reason: string;
  /** Target pool address (base58) */
  targetPoolAddress: string;
  /** Target DEX */
  targetDex: string;
}

// Thresholds
const MAX_BREAK_EVEN_DAYS = 7;
const MIN_NET_BENEFIT_PER_DAY = 0.5; // USD
const MIN_TARGET_TVL = 50_000; // USD
const TX_COST_SOL = 0.01; // 2 transactions × 0.005 SOL each

/**
 * Estimate slippage cost based on position size relative to pool TVL.
 * Larger positions relative to TVL incur more slippage.
 */
function estimateSlippageCostUSD(positionValueUSD: number, poolTvlUSD: number): number {
  if (poolTvlUSD <= 0) return positionValueUSD * 0.05; // 5% worst case
  const ratio = positionValueUSD / poolTvlUSD;
  // Quadratic slippage model: slippage % ≈ ratio * 0.5 (capped at 5%)
  const slippagePct = Math.min(ratio * 0.5, 0.05);
  // Slippage on both close and open
  return positionValueUSD * slippagePct * 2;
}

/**
 * Analyze whether migrating a position from one pool to another is profitable.
 */
export async function analyzeMigration(params: {
  currentPool: PoolInfo;
  targetPool: PoolInfo;
  positionValueUSD: number;
  solPriceUSD: number;
}): Promise<MigrationAnalysis> {
  const { currentPool, targetPool, positionValueUSD, solPriceUSD } = params;

  const targetTvl = targetPool.tvl instanceof Decimal ? targetPool.tvl.toNumber() : Number(targetPool.tvl);
  const targetAddr = targetPool.address.toBase58();

  // Quick reject: insufficient target TVL
  if (targetTvl < MIN_TARGET_TVL) {
    return {
      profitable: false,
      netBenefitPerDay: 0,
      breakEvenDays: Infinity,
      reason: `Target pool TVL ($${targetTvl.toFixed(0)}) below minimum ($${MIN_TARGET_TVL})`,
      targetPoolAddress: targetAddr,
      targetDex: targetPool.dex,
    };
  }

  // Daily yields in USD
  const currentApr = currentPool.apr24h instanceof Decimal ? currentPool.apr24h.toNumber() : Number(currentPool.apr24h);
  const targetApr = targetPool.apr24h instanceof Decimal ? targetPool.apr24h.toNumber() : Number(targetPool.apr24h);

  const currentDailyYieldUSD = (currentApr / 100 / 365) * positionValueUSD;
  const targetDailyYieldUSD = (targetApr / 100 / 365) * positionValueUSD;
  const dailyYieldDiff = targetDailyYieldUSD - currentDailyYieldUSD;

  // Migration costs
  const txCostUSD = TX_COST_SOL * solPriceUSD;
  const slippageCost = estimateSlippageCostUSD(positionValueUSD, targetTvl);
  const totalMigrationCost = txCostUSD + slippageCost;

  // Break-even calculation
  const breakEvenDays = dailyYieldDiff > 0 ? totalMigrationCost / dailyYieldDiff : Infinity;

  // Amortize costs over break-even window (7 days) for net benefit
  const amortizedDailyCost = totalMigrationCost / MAX_BREAK_EVEN_DAYS;
  const netBenefitPerDay = dailyYieldDiff - amortizedDailyCost;

  // Decision
  const profitable =
    breakEvenDays < MAX_BREAK_EVEN_DAYS &&
    netBenefitPerDay > MIN_NET_BENEFIT_PER_DAY &&
    targetTvl >= MIN_TARGET_TVL;

  let reason: string;
  if (profitable) {
    reason = `Migration to ${targetPool.dex} pool ${targetAddr.slice(0, 8)}… recommended. ` +
      `APR improves from ${currentApr.toFixed(1)}% → ${targetApr.toFixed(1)}%. ` +
      `Net gain: $${netBenefitPerDay.toFixed(2)}/day after costs. ` +
      `Break-even in ${breakEvenDays.toFixed(1)} days. ` +
      `Migration cost: $${totalMigrationCost.toFixed(2)} (tx: $${txCostUSD.toFixed(2)}, slippage: $${slippageCost.toFixed(2)}).`;
  } else {
    const reasons: string[] = [];
    if (dailyYieldDiff <= 0) reasons.push(`target APR (${targetApr.toFixed(1)}%) not higher than current (${currentApr.toFixed(1)}%)`);
    if (breakEvenDays >= MAX_BREAK_EVEN_DAYS) reasons.push(`break-even ${breakEvenDays === Infinity ? '∞' : breakEvenDays.toFixed(1)} days exceeds ${MAX_BREAK_EVEN_DAYS}-day limit`);
    if (netBenefitPerDay <= MIN_NET_BENEFIT_PER_DAY) reasons.push(`net benefit $${netBenefitPerDay.toFixed(2)}/day below $${MIN_NET_BENEFIT_PER_DAY} threshold`);
    reason = `Migration to ${targetPool.dex} pool ${targetAddr.slice(0, 8)}… not recommended: ${reasons.join('; ')}.`;
  }

  return {
    profitable,
    netBenefitPerDay: parseFloat(netBenefitPerDay.toFixed(4)),
    breakEvenDays: breakEvenDays === Infinity ? Infinity : parseFloat(breakEvenDays.toFixed(2)),
    reason,
    targetPoolAddress: targetAddr,
    targetDex: targetPool.dex,
  };
}
