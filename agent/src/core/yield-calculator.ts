import Decimal from 'decimal.js';
import { YieldCalcInput, YieldCalcOutput } from '../types/index.js';

/**
 * Yield Calculator
 * 
 * Given a target daily yield %, calculates the optimal price range.
 * 
 * Key insight: Tighter range = higher fee capture but more rebalancing.
 * We need to find the sweet spot where:
 *   expected_yield - rebalance_costs >= target_yield
 */

// Constants
const SECONDS_PER_DAY = 86400;
const GAS_COST_SOL = new Decimal(0.001); // approximate rebalance cost
const SOL_PRICE_USD = new Decimal(200); // will be fetched dynamically

export class YieldCalculator {
  /**
   * Calculate optimal range for target yield
   */
  static calculate(input: YieldCalcInput): YieldCalcOutput {
    const {
      targetDailyYield,
      currentPrice,
      volatility24h,
      poolFee,
      volume24h,
      tvl,
    } = input;

    // Convert target to decimal (0.4% -> 0.004)
    const targetYieldDecimal = new Decimal(targetDailyYield).div(100);

    // Fee revenue per $ of liquidity per day
    // Formula: (volume * fee_rate) / tvl
    const feeRate = new Decimal(poolFee).div(10000); // bps to decimal
    const dailyFeeRevenue = volume24h.mul(feeRate).div(tvl);

    // For concentrated liquidity, yield scales inversely with range width
    // If you're in range 100% of time with width W, your yield multiplier is ~1/W
    // (relative to full-range position)

    // Calculate range width needed for target yield
    // target_yield = base_yield * (1 / range_width_percent) * time_in_range
    // Assuming we want 90% time in range (allowing for some out-of-range)
    const timeInRange = new Decimal(0.9);
    
    // Solve for range width:
    // range_width = base_yield * time_in_range / target_yield
    let rangeWidthPercent = dailyFeeRevenue
      .mul(timeInRange)
      .div(targetYieldDecimal);

    // Clamp range width to reasonable bounds
    // Min: 1% (very tight, lots of rebalancing)
    // Max: 50% (wider than this, yields diminish)
    const MIN_RANGE = new Decimal(0.01);
    const MAX_RANGE = new Decimal(0.50);
    
    if (rangeWidthPercent.lt(MIN_RANGE)) {
      rangeWidthPercent = MIN_RANGE;
    } else if (rangeWidthPercent.gt(MAX_RANGE)) {
      rangeWidthPercent = MAX_RANGE;
    }

    // Calculate price bounds
    // Center on current price, extend range_width/2 in each direction
    const halfWidth = rangeWidthPercent.div(2);
    const recommendedLower = currentPrice.mul(new Decimal(1).sub(halfWidth));
    const recommendedUpper = currentPrice.mul(new Decimal(1).add(halfWidth));

    // Estimate rebalances per day based on volatility and range
    // If daily volatility > range width, expect more rebalances
    const volatilityRatio = volatility24h.div(rangeWidthPercent);
    let estimatedRebalancesPerDay = 0;
    
    if (volatilityRatio.gt(1)) {
      // Volatility exceeds range, expect multiple rebalances
      estimatedRebalancesPerDay = volatilityRatio.toNumber();
    } else if (volatilityRatio.gt(0.5)) {
      // Moderate volatility, occasional rebalance
      estimatedRebalancesPerDay = 0.5;
    }
    // else: low volatility, likely no rebalance needed

    // Calculate actual expected yield after gas costs
    const rebalanceCostUsd = GAS_COST_SOL
      .mul(SOL_PRICE_USD)
      .mul(estimatedRebalancesPerDay);
    
    // Gross yield (before rebalance costs)
    const grossYield = dailyFeeRevenue
      .div(rangeWidthPercent)
      .mul(timeInRange);
    
    // Net yield
    const estimatedDailyYield = grossYield.sub(
      rebalanceCostUsd.div(new Decimal(1000)) // normalize to per-$1000 position
    );

    // Confidence score based on data quality and volatility predictability
    let confidence = 80;
    
    // Lower confidence if:
    // - Range is at min/max bounds (we're constrained)
    if (rangeWidthPercent.eq(MIN_RANGE) || rangeWidthPercent.eq(MAX_RANGE)) {
      confidence -= 20;
    }
    // - High volatility (unpredictable)
    if (volatilityRatio.gt(2)) {
      confidence -= 15;
    }
    // - Low volume (unreliable fee data)
    if (volume24h.lt(tvl.mul(0.1))) {
      confidence -= 10;
    }

    return {
      recommendedLower,
      recommendedUpper,
      rangeWidthPercent: rangeWidthPercent.mul(100), // convert to percentage
      estimatedDailyYield: estimatedDailyYield.mul(100), // convert to percentage
      estimatedRebalancesPerDay,
      confidence: Math.max(0, Math.min(100, confidence)),
    };
  }

  /**
   * Calculate if rebalancing is profitable
   * Returns true if expected benefit > cost * threshold
   */
  static isRebalanceProfitable(
    currentYield: Decimal,
    expectedYieldAfterRebalance: Decimal,
    gasCostSol: Decimal,
    positionValueUsd: Decimal,
    daysToBreakeven: number = 2 // must recoup gas in N days
  ): boolean {
    const yieldImprovement = expectedYieldAfterRebalance.sub(currentYield);
    const dailyBenefitUsd = positionValueUsd.mul(yieldImprovement).div(100);
    
    const gasCostUsd = gasCostSol.mul(SOL_PRICE_USD);
    const breakevenDays = gasCostUsd.div(dailyBenefitUsd);
    
    return breakevenDays.lte(daysToBreakeven);
  }

  /**
   * Adjust range based on historical price movement
   * Shifts range towards likely price direction
   */
  static adjustRangeForMomentum(
    lower: Decimal,
    upper: Decimal,
    priceChange24h: Decimal, // percentage
    momentum: 'bullish' | 'bearish' | 'neutral'
  ): { lower: Decimal; upper: Decimal } {
    const rangeWidth = upper.sub(lower);
    const shiftPercent = new Decimal(0.1); // shift 10% of range
    const shift = rangeWidth.mul(shiftPercent);

    if (momentum === 'bullish' && priceChange24h.gt(2)) {
      // Price trending up, shift range higher
      return {
        lower: lower.add(shift),
        upper: upper.add(shift),
      };
    } else if (momentum === 'bearish' && priceChange24h.lt(-2)) {
      // Price trending down, shift range lower
      return {
        lower: lower.sub(shift),
        upper: upper.sub(shift),
      };
    }

    // Neutral or weak trend, keep centered
    return { lower, upper };
  }
}
