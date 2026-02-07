import Decimal from 'decimal.js';
import { PublicKey } from '@solana/web3.js';
import {
  DexType,
  PoolInfo,
} from '../types/index.js';
import { IDexAdapter } from '../dex/interface.js';

/**
 * Simplified pool info for API responses
 */
export interface SimplePoolInfo {
  address: string;
  tokenA: { symbol: string; mint: string };
  tokenB: { symbol: string; mint: string };
  dex: string;
  tvl: number;
  volume24h: number;
  feeRate: number;
  currentPrice: number;
  apr24h: number;
}

/**
 * LP Aggregator
 * 
 * The core engine that:
 * 1. Discovers pools across all DEXs
 * 2. Compares yields, TVL, volume
 * 3. Recommends optimal DEX + range for a given strategy
 * 
 * Think "Jupiter for LP" - but instead of routing swaps, we route liquidity.
 */
export class LPAggregator {
  private adapters: IDexAdapter[] = [];

  constructor() {
    // Adapters are registered after construction
  }

  /**
   * Register a DEX adapter
   */
  registerAdapter(adapter: IDexAdapter): void {
    this.adapters.push(adapter);
    console.log(`[Aggregator] Registered adapter: ${adapter.name}`);
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): IDexAdapter[] {
    return this.adapters;
  }

  /**
   * Find all pools across all DEXs for a token pair
   */
  async findPoolsForPair(tokenA: PublicKey, tokenB: PublicKey): Promise<PoolInfo[]> {
    const allPools: PoolInfo[] = [];

    const poolPromises = this.adapters.map(async (adapter) => {
      try {
        const pools = await adapter.findPools(tokenA, tokenB);
        return pools;
      } catch (error) {
        console.warn(`[Aggregator] Failed to fetch pools from ${adapter.name}:`, error);
        return [];
      }
    });

    const results = await Promise.all(poolPromises);
    for (const pools of results) {
      allPools.push(...pools);
    }

    // Sort by TVL descending
    allPools.sort((a, b) => {
      const tvlA = a.tvl instanceof Decimal ? a.tvl.toNumber() : Number(a.tvl);
      const tvlB = b.tvl instanceof Decimal ? b.tvl.toNumber() : Number(b.tvl);
      return tvlB - tvlA;
    });

    return allPools;
  }

  /**
   * Convert PoolInfo to SimplePoolInfo for API responses
   */
  static toSimple(pool: PoolInfo): SimplePoolInfo {
    return {
      address: pool.address instanceof PublicKey ? pool.address.toBase58() : String(pool.address),
      tokenA: { 
        symbol: pool.tokenASymbol || 'Unknown', 
        mint: pool.tokenA instanceof PublicKey ? pool.tokenA.toBase58() : String(pool.tokenA)
      },
      tokenB: { 
        symbol: pool.tokenBSymbol || 'Unknown', 
        mint: pool.tokenB instanceof PublicKey ? pool.tokenB.toBase58() : String(pool.tokenB)
      },
      dex: pool.dex,
      tvl: pool.tvl instanceof Decimal ? pool.tvl.toNumber() : Number(pool.tvl),
      volume24h: pool.volume24h instanceof Decimal ? pool.volume24h.toNumber() : Number(pool.volume24h),
      feeRate: (pool.fee || 0) / 10000, // Convert bps to decimal
      currentPrice: pool.currentPrice instanceof Decimal ? pool.currentPrice.toNumber() : Number(pool.currentPrice),
      apr24h: pool.apr24h instanceof Decimal ? pool.apr24h.toNumber() : Number(pool.apr24h || 0),
    };
  }

  /**
   * Get best pools for a token pair, comparing across DEXs
   */
  async getBestPools(tokenA: PublicKey, tokenB: PublicKey, limit: number = 5): Promise<SimplePoolInfo[]> {
    const pools = await this.findPoolsForPair(tokenA, tokenB);
    
    // Score and sort by a combination of APR, TVL, and volume
    const scored = pools.map(pool => {
      const simple = LPAggregator.toSimple(pool);
      
      // Estimate APR from fee rate and volume/tvl ratio
      const estimatedApr = simple.feeRate * (simple.volume24h / simple.tvl) * 365 * 100;
      
      // Score: 50% APR, 30% TVL (log scale), 20% volume
      const aprScore = Math.min(estimatedApr, 200) / 2; // cap at 100 points
      const tvlScore = Math.log10(Math.max(simple.tvl, 1)) * 5; // 5 points per order of magnitude
      const volumeScore = Math.log10(Math.max(simple.volume24h, 1)) * 3;
      
      return {
        pool: simple,
        score: aprScore + tvlScore + volumeScore,
        estimatedApr,
      };
    });
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, limit).map(s => ({
      ...s.pool,
      apr24h: s.estimatedApr,
    }));
  }

  /**
   * Compare pools for the same token pair across DEXs
   */
  async comparePoolsByPair(tokenA: PublicKey, tokenB: PublicKey): Promise<{
    tokenA: string;
    tokenB: string;
    pools: (SimplePoolInfo & { estimatedApr: number; rank: number })[];
    recommendation: {
      dex: string;
      address: string;
      reason: string;
    } | null;
  }> {
    const pools = await this.findPoolsForPair(tokenA, tokenB);
    
    if (pools.length === 0) {
      return {
        tokenA: tokenA.toBase58(),
        tokenB: tokenB.toBase58(),
        pools: [],
        recommendation: null,
      };
    }
    
    // Calculate estimated APR for each pool
    const withApr = pools.map((pool, index) => {
      const simple = LPAggregator.toSimple(pool);
      const estimatedApr = simple.feeRate * (simple.volume24h / simple.tvl) * 365 * 100;
      return {
        ...simple,
        estimatedApr,
        rank: index + 1,
      };
    });
    
    // Sort by estimated APR
    withApr.sort((a, b) => b.estimatedApr - a.estimatedApr);
    
    // Update ranks after sorting
    withApr.forEach((pool, index) => {
      pool.rank = index + 1;
    });
    
    const best = withApr[0];
    
    return {
      tokenA: tokenA.toBase58(),
      tokenB: tokenB.toBase58(),
      pools: withApr,
      recommendation: {
        dex: best.dex,
        address: best.address,
        reason: `Highest estimated APR (${best.estimatedApr.toFixed(2)}%) based on fee rate and volume/TVL ratio`,
      },
    };
  }
}

export default LPAggregator;
