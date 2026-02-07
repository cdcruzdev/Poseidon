import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import Decimal from 'decimal.js';
import {
  Position,
  RebalanceDecision,
  RebalanceTrigger,
  StrategyConfig,
  PriceFeed,
} from '../types/index.js';
import { DexRegistry, RebalanceParams } from '../dex/interface.js';
import { YieldCalculator } from './yield-calculator.js';

/**
 * Position Monitor
 * 
 * The autonomous agent core that:
 * 1. Monitors all user positions
 * 2. Detects when rebalancing is needed
 * 3. Executes rebalances when profitable
 * 
 * Runs 24/7 without human intervention.
 */
export class PositionMonitor {
  private connection: Connection;
  private registry: DexRegistry;
  private positions: Map<string, Position> = new Map();
  private priceFeeds: Map<string, PriceFeed> = new Map();
  private isRunning: boolean = false;
  private checkIntervalMs: number;
  private wallet: Keypair;

  // Fee configuration
  private performanceFeeBps: number = 500; // 5% of profits

  constructor(
    connection: Connection,
    registry: DexRegistry,
    wallet: Keypair,
    checkIntervalMs: number = 60000 // 1 minute default
  ) {
    this.connection = connection;
    this.registry = registry;
    this.wallet = wallet;
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Start monitoring all positions
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Monitor already running');
      return;
    }

    this.isRunning = true;
    console.log('Position monitor started');

    while (this.isRunning) {
      try {
        await this.checkAllPositions();
      } catch (error) {
        console.error('Error in monitoring loop:', error);
      }

      await this.sleep(this.checkIntervalMs);
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    console.log('Position monitor stopped');
  }

  /**
   * Add a position to monitor
   */
  addPosition(position: Position): void {
    this.positions.set(position.id, position);
    console.log(`Monitoring position: ${position.id}`);
  }

  /**
   * Remove a position from monitoring
   */
  removePosition(positionId: string): void {
    this.positions.delete(positionId);
    console.log(`Stopped monitoring position: ${positionId}`);
  }

  /**
   * Check all positions and rebalance if needed
   */
  private async checkAllPositions(): Promise<void> {
    for (const [id, position] of this.positions) {
      try {
        // Skip if auto-rebalance is disabled
        if (!position.strategy.autoRebalance) {
          continue;
        }

        // Get current price
        const adapter = this.registry.get(position.dex);
        const currentPrice = await adapter.getCurrentPrice(position.pool);

        // Update price feed
        this.updatePriceFeed(position, currentPrice);

        // Make rebalance decision
        const decision = await this.shouldRebalance(position, currentPrice);

        if (decision.shouldRebalance) {
          console.log(`Rebalancing position ${id}: ${decision.reason}`);
          await this.executeRebalance(position, decision);
        }
      } catch (error) {
        console.error(`Error checking position ${id}:`, error);
      }
    }
  }

  /**
   * Determine if a position should be rebalanced
   */
  async shouldRebalance(
    position: Position,
    currentPrice: Decimal
  ): Promise<RebalanceDecision> {
    // Check minimum rebalance interval
    if (position.lastRebalanceAt) {
      const timeSinceRebalance = Date.now() - position.lastRebalanceAt;
      if (timeSinceRebalance < position.strategy.minRebalanceInterval * 1000) {
        return { shouldRebalance: false, reason: 'Too soon since last rebalance' };
      }
    }

    // Trigger 1: Price exit range
    if (currentPrice.lt(position.lowerPrice) || currentPrice.gt(position.upperPrice)) {
      const newRange = this.calculateNewRange(position, currentPrice);
      
      return {
        shouldRebalance: true,
        trigger: 'price_exit',
        reason: `Price ${currentPrice.toFixed(4)} outside range [${position.lowerPrice.toFixed(4)}, ${position.upperPrice.toFixed(4)}]`,
        newLowerPrice: newRange.lower,
        newUpperPrice: newRange.upper,
        estimatedGasCost: new Decimal(0.002), // Estimate, will be calculated
        riskScore: this.calculateRiskScore(position, currentPrice),
      };
    }

    // Trigger 2: Yield target not met
    if (position.strategy.targetDailyYield !== undefined) {
      const currentYield = await this.calculateCurrentYield(position);
      const targetYield = new Decimal(position.strategy.targetDailyYield);

      // If current yield is less than 80% of target, consider rebalancing
      if (currentYield.lt(targetYield.mul(0.8))) {
        const newRange = this.calculateRangeForYield(position, targetYield);
        
        // Check if rebalancing would actually improve yield
        const expectedYieldAfter = await this.estimateYieldAfterRebalance(
          position,
          newRange.lower,
          newRange.upper
        );

        if (expectedYieldAfter.gt(currentYield.mul(1.2))) { // 20% improvement threshold
          return {
            shouldRebalance: true,
            trigger: 'yield_target',
            reason: `Current yield ${currentYield.toFixed(2)}% below target ${targetYield.toFixed(2)}%`,
            newLowerPrice: newRange.lower,
            newUpperPrice: newRange.upper,
            estimatedBenefit: expectedYieldAfter.sub(currentYield),
            riskScore: this.calculateRiskScore(position, currentPrice),
          };
        }
      }
    }

    return { shouldRebalance: false };
  }

  /**
   * Execute a rebalance
   */
  private async executeRebalance(
    position: Position,
    decision: RebalanceDecision
  ): Promise<void> {
    if (!decision.newLowerPrice || !decision.newUpperPrice) {
      console.error('No new range provided for rebalance');
      return;
    }

    const adapter = this.registry.get(position.dex);

    // Estimate gas and check profitability
    const gasCost = await adapter.estimateGas('rebalance');
    
    if (decision.estimatedBenefit && decision.estimatedBenefit.lt(gasCost.mul(1.5))) {
      console.log(`Skipping rebalance - not profitable. Benefit: ${decision.estimatedBenefit}, Gas: ${gasCost}`);
      return;
    }

    // Build and execute rebalance transaction
    const params: RebalanceParams = {
      positionAddress: new PublicKey(position.id),
      wallet: this.wallet,
      newLowerPrice: decision.newLowerPrice,
      newUpperPrice: decision.newUpperPrice,
      slippageBps: position.strategy.maxSlippageBps,
    };

    try {
      const result = await adapter.rebalance(params);

      if (result.success) {
        console.log(`Rebalance successful: ${result.signature}`);
        
        // Update position
        position.lowerPrice = decision.newLowerPrice;
        position.upperPrice = decision.newUpperPrice;
        position.lastRebalanceAt = Date.now();
        position.status = 'active';
        
        this.positions.set(position.id, position);

        // Log for notifications
        await this.logRebalance(position, decision, result.signature!);
      } else {
        console.error(`Rebalance failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Rebalance execution error:', error);
    }
  }

  /**
   * Calculate new range centered on current price
   */
  private calculateNewRange(
    position: Position,
    currentPrice: Decimal
  ): { lower: Decimal; upper: Decimal } {
    // Maintain the same range width, centered on new price
    const rangeWidth = position.upperPrice.sub(position.lowerPrice);
    const halfWidth = rangeWidth.div(2);

    return {
      lower: currentPrice.sub(halfWidth),
      upper: currentPrice.add(halfWidth),
    };
  }

  /**
   * Calculate range to achieve target yield
   */
  private calculateRangeForYield(
    position: Position,
    targetYield: Decimal
  ): { lower: Decimal; upper: Decimal } {
    // Use yield calculator
    // This is a simplified version - full implementation would fetch pool data
    const currentPrice = position.lowerPrice.add(position.upperPrice).div(2);
    
    // Estimate range width based on target yield
    // Higher yield = tighter range
    const baseWidth = new Decimal(0.2); // 20% default
    const yieldFactor = new Decimal(0.4).div(targetYield); // 0.4% daily as baseline
    const adjustedWidth = baseWidth.mul(yieldFactor);

    // Clamp to reasonable bounds
    const width = Decimal.max(new Decimal(0.02), Decimal.min(adjustedWidth, new Decimal(0.5)));
    const halfWidth = width.div(2);

    return {
      lower: currentPrice.mul(new Decimal(1).sub(halfWidth)),
      upper: currentPrice.mul(new Decimal(1).add(halfWidth)),
    };
  }

  /**
   * Calculate current yield of a position
   */
  private async calculateCurrentYield(position: Position): Promise<Decimal> {
    // Calculate based on unclaimed fees and position age
    const positionAge = Date.now() - position.createdAt;
    const daysActive = positionAge / (24 * 60 * 60 * 1000);
    
    if (daysActive < 0.1) {
      return new Decimal(0); // Not enough data
    }

    const totalFees = position.unclaimedFeesA.add(position.unclaimedFeesB);
    const positionValue = position.tokenAAmount.add(position.tokenBAmount);
    
    if (positionValue.isZero()) {
      return new Decimal(0);
    }

    // Daily yield percentage
    const dailyYield = totalFees.div(positionValue).div(daysActive).mul(100);
    return dailyYield;
  }

  /**
   * Estimate yield after rebalancing to new range
   */
  private async estimateYieldAfterRebalance(
    position: Position,
    newLower: Decimal,
    newUpper: Decimal
  ): Promise<Decimal> {
    // Simplified estimation
    // In production, this would use historical data and pool metrics
    const newWidth = newUpper.sub(newLower);
    const oldWidth = position.upperPrice.sub(position.lowerPrice);
    
    const currentYield = await this.calculateCurrentYield(position);
    
    // Tighter range = higher yield (approximately)
    const widthRatio = oldWidth.div(newWidth);
    return currentYield.mul(widthRatio).mul(0.9); // 10% haircut for estimation error
  }

  /**
   * Calculate risk score (0-100)
   */
  private calculateRiskScore(position: Position, currentPrice: Decimal): number {
    let risk = 50; // Base risk

    // Out of range = higher risk
    if (currentPrice.lt(position.lowerPrice) || currentPrice.gt(position.upperPrice)) {
      risk += 20;
    }

    // Very tight range = higher risk
    const rangeWidth = position.upperPrice.sub(position.lowerPrice).div(currentPrice);
    if (rangeWidth.lt(0.05)) {
      risk += 15;
    }

    // Recent rebalance = lower immediate risk
    if (position.lastRebalanceAt && Date.now() - position.lastRebalanceAt < 3600000) {
      risk -= 10;
    }

    return Math.max(0, Math.min(100, risk));
  }

  /**
   * Update price feed for a position
   */
  private updatePriceFeed(position: Position, price: Decimal): void {
    const key = `${position.pool.toBase58()}`;
    this.priceFeeds.set(key, {
      tokenA: position.pool.toBase58(), // Simplified
      tokenB: position.pool.toBase58(),
      price,
      timestamp: Date.now(),
      source: 'dex',
    });
  }

  /**
   * Log rebalance for notification system
   */
  private async logRebalance(
    position: Position,
    decision: RebalanceDecision,
    signature: string
  ): Promise<void> {
    const log = {
      timestamp: new Date().toISOString(),
      positionId: position.id,
      trigger: decision.trigger,
      reason: decision.reason,
      oldRange: [position.lowerPrice.toString(), position.upperPrice.toString()],
      newRange: [decision.newLowerPrice?.toString(), decision.newUpperPrice?.toString()],
      signature,
    };

    console.log('REBALANCE:', JSON.stringify(log));
    
    // TODO: Write to notifications file for Telegram alerts
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get all monitored positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by ID
   */
  getPosition(id: string): Position | undefined {
    return this.positions.get(id);
  }
}
