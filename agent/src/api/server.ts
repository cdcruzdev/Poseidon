/**
 * Poseidon API Server
 * HTTP endpoints for frontend communication
 */

import http from 'http';
import { Connection, PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { createDefaultRegistry, DexRegistry } from '../dex/index.js';
import { getPriceOracle } from '../core/price-oracle.js';
import { FeeCollector } from '../core/fee-collector.js';
import { analyzeMigration } from '../core/migration-analyzer.js';
import { LPAggregator } from '../core/aggregator.js';
import { PoolInfo } from '../types/index.js';
import { AgentActivityTracker } from '../core/activity-tracker.js';
import { ReasoningLogger } from '../core/reasoning-logger.js';
import { PositionMonitor } from '../core/position-monitor.js';

const PORT = process.env.API_PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Well-known token addresses
const TOKENS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
};

// Initialize components
let registry: DexRegistry | null = null;
let feeCollector: FeeCollector | null = null;
let positionMonitor: PositionMonitor | null = null;
const priceOracle = getPriceOracle();
const activityTracker = AgentActivityTracker.getInstance();
const reasoningLogger = ReasoningLogger.getInstance();
const agentStartTime = Date.now();

/** Set the fee collector instance (called from index.ts) */
export function setFeeCollector(fc: FeeCollector): void {
  feeCollector = fc;
}

/** Set the position monitor instance (called from index.ts) */
export function setPositionMonitor(pm: PositionMonitor): void {
  positionMonitor = pm;
}

/** Get the activity tracker singleton */
export function getActivityTracker(): AgentActivityTracker {
  return activityTracker;
}

/** Get the reasoning logger singleton */
export function getReasoningLogger(): ReasoningLogger {
  return reasoningLogger;
}

interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface SimplePool {
  address: string;
  tokenA: { symbol: string; mint: string };
  tokenB: { symbol: string; mint: string };
  dex: string;
  poolType: string;
  tvl: number;
  volume24h: number;
  feeRate: number;
  feeBps: number;
  currentPrice: number;
  apr24h: number;
}

interface ScoredPool {
  address: string;
  dex: string;
  tvl: number;
  yield24h: number;
  fee: number;
  score: number;
}

interface BestPoolResponse {
  bestPool: ScoredPool | null;
  alternatives: ScoredPool[];
}

async function initializeRegistry(): Promise<DexRegistry> {
  if (registry) return registry;
  
  console.log('[API] Initializing DEX registry...');
  const connection = new Connection(RPC_URL, 'confirmed');
  registry = createDefaultRegistry();
  await registry.initialize(connection);
  console.log('[API] Registry initialized');
  
  return registry;
}

function convertPoolToSimple(pool: PoolInfo): SimplePool {
  try {
    return {
      address: typeof pool.address === 'string' ? pool.address : pool.address.toBase58(),
      tokenA: { 
        symbol: pool.tokenASymbol || 'Unknown', 
        mint: typeof pool.tokenA === 'string' ? pool.tokenA : pool.tokenA.toBase58() 
      },
      tokenB: { 
        symbol: pool.tokenBSymbol || 'Unknown', 
        mint: typeof pool.tokenB === 'string' ? pool.tokenB : pool.tokenB.toBase58() 
      },
      dex: pool.dex,
      poolType: pool.poolType || 'unknown',
      tvl: pool.tvl instanceof Decimal ? pool.tvl.toNumber() : Number(pool.tvl || 0),
      volume24h: pool.volume24h instanceof Decimal ? pool.volume24h.toNumber() : Number(pool.volume24h || 0),
      feeRate: (pool.fee || 0) / 10000, // Convert bps to decimal
      feeBps: pool.fee || 0, // Original fee in basis points
      currentPrice: pool.currentPrice instanceof Decimal ? pool.currentPrice.toNumber() : Number(pool.currentPrice || 0),
      apr24h: pool.apr24h instanceof Decimal ? pool.apr24h.toNumber() : Number(pool.apr24h || 0),
    };
  } catch (error: any) {
    console.error(`[API] Error converting pool from ${pool.dex}:`, error.message);
    throw error;
  }
}

/**
 * Calculate pool score based on yield, liquidity, and fees
 * 
 * Scoring Algorithm:
 *   yield_score = (volume_24h / tvl) * 365 * 100  // Annualized yield %
 *   liquidity_score = log10(tvl) * 10            // Higher TVL = less slippage
 *   fee_penalty = fee_bps * 2                    // Lower fees preferred
 *   score = yield_score + liquidity_score - fee_penalty
 */
function calculatePoolScore(pool: SimplePool): number {
  // Avoid division by zero
  if (pool.tvl <= 0) return 0;
  
  // Annualized yield score: (volume_24h / tvl) * 365 * 100
  const yieldScore = (pool.volume24h / pool.tvl) * 365 * 100;
  
  // Liquidity score: log10(tvl) * 10 (higher TVL = less slippage)
  const liquidityScore = Math.log10(Math.max(pool.tvl, 1)) * 10;
  
  // Fee penalty: fee_bps * 2 (lower fees preferred)
  const feePenalty = pool.feeBps * 2;
  
  // Final score
  const score = yieldScore + liquidityScore - feePenalty;
  
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert SimplePool to ScoredPool format for API response
 */
function convertToScoredPool(pool: SimplePool): ScoredPool {
  // Calculate 24h yield as daily rate: (volume_24h / tvl) * feeRate
  const yield24h = pool.tvl > 0 ? (pool.volume24h / pool.tvl) * pool.feeRate : 0;
  
  return {
    address: pool.address,
    dex: pool.dex,
    tvl: Math.round(pool.tvl),
    yield24h: Math.round(yield24h * 10000) / 10000, // 4 decimal places
    fee: pool.feeRate,
    score: calculatePoolScore(pool),
  };
}

function jsonResponse(res: http.ServerResponse, data: ApiResponse, status = 200): void {
  try {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
  } catch (error: any) {
    console.error('[API] JSON serialization error:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
  }
}

function parseQuery(url: string): Record<string, string> {
  const queryString = url.split('?')[1] || '';
  const params: Record<string, string> = {};
  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    if (key) params[key] = decodeURIComponent(value || '');
  }
  return params;
}

function getTokenMint(symbolOrMint: string): PublicKey | null {
  // Check if it's a known symbol
  const upperSymbol = symbolOrMint.toUpperCase();
  if (TOKENS[upperSymbol]) {
    return new PublicKey(TOKENS[upperSymbol]);
  }
  
  // Try parsing as a mint address
  try {
    return new PublicKey(symbolOrMint);
  } catch {
    return null;
  }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = req.url || '/';
  const method = req.method || 'GET';
  const path = url.split('?')[0];

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  console.log(`[API] ${method} ${path}`);

  try {
    // Health check
    if (path === '/health') {
      jsonResponse(res, { success: true, data: { status: 'ok', timestamp: Date.now() } });
      return;
    }

    // Get pools for a token pair
    if (path === '/api/pools') {
      const query = parseQuery(url);
      const tokenA = query.tokenA;
      const tokenB = query.tokenB;
      const dexFilter = query.dex;
      const limit = parseInt(query.limit || '50', 10);

      if (!tokenA || !tokenB) {
        jsonResponse(res, { success: false, error: 'Missing tokenA or tokenB parameter' }, 400);
        return;
      }

      const mintA = getTokenMint(tokenA);
      const mintB = getTokenMint(tokenB);

      if (!mintA || !mintB) {
        jsonResponse(res, { success: false, error: 'Invalid token symbol or mint address' }, 400);
        return;
      }

      const reg = await initializeRegistry();
      const adapters = reg.getAll();
      
      // Filter adapters if dex specified
      const filteredAdapters = dexFilter 
        ? adapters.filter(a => a.dexType === dexFilter.toLowerCase())
        : adapters;

      // Fetch from all adapters in parallel for better performance
      const poolResults = await Promise.allSettled(
        filteredAdapters.map(async (adapter) => {
          try {
            const pools = await adapter.findPools(mintA, mintB);
            return pools.map(convertPoolToSimple);
          } catch (error) {
            console.warn(`[API] Failed to fetch from ${adapter.name}:`, error);
            return [];
          }
        })
      );

      // Flatten results, handling both fulfilled and rejected promises
      let allPools: SimplePool[] = poolResults
        .filter((r): r is PromiseFulfilledResult<SimplePool[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);

      // Sort by TVL and limit
      allPools.sort((a, b) => b.tvl - a.tvl);
      allPools = allPools.slice(0, limit);

      // Enrich with USD prices from oracle
      const prices = await priceOracle.getPrices([tokenA, tokenB]);

      const enrichedPools = allPools.map(pool => ({
        ...pool,
        tokenAPrice: prices.get(tokenA.toUpperCase()) || 0,
        tokenBPrice: prices.get(tokenB.toUpperCase()) || 0,
      }));

      jsonResponse(res, { success: true, data: enrichedPools });
      return;
    }

    // Get price for a token
    if (path === '/api/price') {
      const query = parseQuery(url);
      const symbol = query.symbol;

      if (!symbol) {
        jsonResponse(res, { success: false, error: 'Missing symbol parameter' }, 400);
        return;
      }

      const price = await priceOracle.getPrice(symbol);
      jsonResponse(res, { success: true, data: { symbol, price } });
      return;
    }

    // Get prices for multiple tokens
    if (path === '/api/prices') {
      const query = parseQuery(url);
      const symbols = query.symbols?.split(',') || [];

      if (symbols.length === 0) {
        jsonResponse(res, { success: false, error: 'Missing symbols parameter' }, 400);
        return;
      }

      const prices = await priceOracle.getPrices(symbols);
      const priceObj: Record<string, number> = {};
      prices.forEach((price, symbol) => {
        priceObj[symbol] = price;
      });

      jsonResponse(res, { success: true, data: priceObj });
      return;
    }

    // Compare pools for a token pair (best yields)
    if (path === '/api/compare') {
      const query = parseQuery(url);
      const tokenA = query.tokenA;
      const tokenB = query.tokenB;

      if (!tokenA || !tokenB) {
        jsonResponse(res, { success: false, error: 'Missing tokenA or tokenB parameter' }, 400);
        return;
      }

      const mintA = getTokenMint(tokenA);
      const mintB = getTokenMint(tokenB);

      if (!mintA || !mintB) {
        jsonResponse(res, { success: false, error: 'Invalid token symbol or mint address' }, 400);
        return;
      }

      const reg = await initializeRegistry();
      const result = await reg.findBestPool(mintA, mintB, 'apr');

      if (!result) {
        jsonResponse(res, { success: true, data: { pools: [], recommendation: null } });
        return;
      }

      // Get all pools for comparison (parallel fetch)
      const adapters = reg.getAll();
      const poolResults = await Promise.allSettled(
        adapters.map(async (adapter) => {
          try {
            const pools = await adapter.findPools(mintA, mintB);
            console.log(`[API] ${adapter.name} returned ${pools.length} pools`);
            const simplePools = pools.map((p, i) => {
              try {
                return convertPoolToSimple(p);
              } catch (e: any) {
                console.error(`[API] Failed to convert pool ${i} from ${adapter.name}:`, e.message);
                return null;
              }
            }).filter((p): p is SimplePool => p !== null);
            console.log(`[API] ${adapter.name} converted to ${simplePools.length} simple pools`);
            return simplePools;
          } catch (error: any) {
            console.warn(`[API] Failed to fetch from ${adapter.name}:`, error.message);
            return [];
          }
        })
      );

      let allPools: SimplePool[] = poolResults
        .filter((r): r is PromiseFulfilledResult<SimplePool[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);
      
      console.log(`[API] Total pools from all DEXes: ${allPools.length}`);

      try {
        // Sort by estimated APR (handle TVL=0 to avoid Infinity)
        allPools.sort((a, b) => {
          const aprA = a.tvl > 0 ? a.feeRate * (a.volume24h / a.tvl) * 365 * 100 : 0;
          const aprB = b.tvl > 0 ? b.feeRate * (b.volume24h / b.tvl) * 365 * 100 : 0;
          return aprB - aprA;
        });

        const prices = await priceOracle.getPrices([tokenA, tokenB]);
        const bestPool = allPools[0];

        jsonResponse(res, {
          success: true,
          data: {
            tokenA,
            tokenB,
            tokenAPrice: prices.get(tokenA.toUpperCase()) || 0,
            tokenBPrice: prices.get(tokenB.toUpperCase()) || 0,
            pools: allPools.slice(0, 10).map((pool, i) => ({
              ...pool,
              estimatedApr: pool.tvl > 0 ? pool.feeRate * (pool.volume24h / pool.tvl) * 365 * 100 : 0,
              rank: i + 1,
            })),
            recommendation: bestPool ? {
              dex: bestPool.dex,
              address: bestPool.address,
              estimatedApr: bestPool.tvl > 0 ? bestPool.feeRate * (bestPool.volume24h / bestPool.tvl) * 365 * 100 : 0,
              reason: 'Highest estimated APR based on fees and volume',
            } : null,
          },
        });
      } catch (error: any) {
        console.error('[API] Error in compare response:', error.message, error.stack);
        jsonResponse(res, { success: false, error: 'Failed to process pools' }, 500);
      }
      return;
    }

    // Best pool selection - returns best pool + alternatives sorted by score
    if (path === '/api/best-pool') {
      const query = parseQuery(url);
      const tokenA = query.tokenA;
      const tokenB = query.tokenB;

      if (!tokenA || !tokenB) {
        jsonResponse(res, { success: false, error: 'Missing tokenA or tokenB parameter' }, 400);
        return;
      }

      const mintA = getTokenMint(tokenA);
      const mintB = getTokenMint(tokenB);

      if (!mintA || !mintB) {
        jsonResponse(res, { success: false, error: 'Invalid token symbol or mint address' }, 400);
        return;
      }

      const reg = await initializeRegistry();
      const adapters = reg.getAll();
      
      // Fetch from all adapters in parallel
      const poolResults = await Promise.allSettled(
        adapters.map(async (adapter) => {
          try {
            const pools = await adapter.findPools(mintA, mintB);
            return pools.map(convertPoolToSimple);
          } catch (error) {
            console.warn(`[API] Failed to fetch from ${adapter.name}:`, error);
            return [];
          }
        })
      );

      // Flatten results and filter out pools with no TVL
      let allPools: SimplePool[] = poolResults
        .filter((r): r is PromiseFulfilledResult<SimplePool[]> => r.status === 'fulfilled')
        .flatMap(r => r.value)
        .filter(pool => pool.tvl > 0);

      if (allPools.length === 0) {
        jsonResponse(res, {
          success: true,
          data: {
            bestPool: null,
            alternatives: [],
          } as BestPoolResponse,
        });
        return;
      }

      // Convert to scored pools and sort by score (descending)
      const scoredPools = allPools
        .map(convertToScoredPool)
        .sort((a, b) => b.score - a.score);

      // Best pool is first, alternatives are next 5
      const bestPool = scoredPools[0];
      const alternatives = scoredPools.slice(1, 6); // Top 5 alternatives

      const response: BestPoolResponse = {
        bestPool,
        alternatives,
      };

      jsonResponse(res, { success: true, data: response });
      return;
    }

    // Fee stats + calculate deposit fee
    if (path === '/api/fees') {
      if (!feeCollector) {
        jsonResponse(res, { success: false, error: 'Fee collector not initialized' }, 503);
        return;
      }

      const query = parseQuery(url);
      const stats = feeCollector.getStats();

      // If depositAmount provided, calculate fee breakdown
      if (query.depositAmount) {
        const amount = new Decimal(query.depositAmount);
        const breakdown = feeCollector.calculateDepositFee(amount);
        jsonResponse(res, {
          success: true,
          data: {
            ...stats,
            depositBreakdown: {
              inputAmount: amount.toString(),
              toPosition: breakdown.toPosition.toString(),
              toTreasury: breakdown.toTreasury.toString(),
              feePercent: `${stats.config.depositFeeBps / 100}%`,
            },
          },
        });
        return;
      }

      jsonResponse(res, { success: true, data: stats });
      return;
    }

    // Agent status
    if (path === '/api/status') {
      const reg = registry;
      const adapters = reg ? reg.getAll() : [];
      
      jsonResponse(res, {
        success: true,
        data: {
          status: reg ? 'running' : 'initializing',
          adapters: adapters.map(a => a.name),
          supportedTokens: Object.keys(TOKENS),
          timestamp: Date.now(),
        },
      });
      return;
    }

    // Migration analysis — find better pools for a current position
    if (path === '/api/migrate/analyze') {
      const query = parseQuery(url);
      const poolAddress = query.pool;
      const dex = query.dex;
      const positionValue = parseFloat(query.value || '1000');

      if (!poolAddress || !dex) {
        jsonResponse(res, { success: false, error: 'Missing pool or dex parameter' }, 400);
        return;
      }

      const reg = await initializeRegistry();
      const adapter = reg.getAll().find(a => a.dexType === dex);
      if (!adapter) {
        jsonResponse(res, { success: false, error: `Unknown dex: ${dex}` }, 400);
        return;
      }

      // Get current pool info
      const currentPool = await adapter.getPoolInfo(new PublicKey(poolAddress));

      // Find alternative pools across all DEXs
      const aggregator = new LPAggregator();
      for (const a of reg.getAll()) {
        aggregator.registerAdapter(a);
      }
      const altPools = await aggregator.findPoolsForPair(currentPool.tokenA, currentPool.tokenB);

      // Get SOL price for cost calculations
      const solPrice = await priceOracle.getPrice('SOL');

      // Analyze each alternative
      const analyses = [];
      const candidates = altPools
        .filter(p => p.address.toBase58() !== poolAddress)
        .slice(0, 10);

      for (const targetPool of candidates) {
        const analysis = await analyzeMigration({
          currentPool,
          targetPool,
          positionValueUSD: positionValue,
          solPriceUSD: solPrice,
        });
        analyses.push({
          ...analysis,
          targetDex: targetPool.dex,
          targetPoolType: targetPool.poolType,
          targetTvl: targetPool.tvl instanceof Decimal ? targetPool.tvl.toNumber() : Number(targetPool.tvl),
          targetApr: targetPool.apr24h instanceof Decimal ? targetPool.apr24h.toNumber() : Number(targetPool.apr24h),
        });
      }

      // Sort: profitable first, then by net benefit
      analyses.sort((a, b) => {
        if (a.profitable && !b.profitable) return -1;
        if (!a.profitable && b.profitable) return 1;
        return b.netBenefitPerDay - a.netBenefitPerDay;
      });

      jsonResponse(res, {
        success: true,
        data: {
          currentPool: {
            address: poolAddress,
            dex,
            apr: currentPool.apr24h instanceof Decimal ? currentPool.apr24h.toNumber() : Number(currentPool.apr24h),
            tvl: currentPool.tvl instanceof Decimal ? currentPool.tvl.toNumber() : Number(currentPool.tvl),
          },
          positionValueUSD: positionValue,
          migrations: analyses,
          bestMigration: analyses.find(a => a.profitable) || null,
        },
      });
      return;
    }

    // Agent activity log
    if (path === '/api/agent/activity') {
      const activities = activityTracker.getAll();
      jsonResponse(res, { success: true, data: { activities } });
      return;
    }

    // Agent reasoning / decisions
    if (path === '/api/agent/reasoning') {
      const decisions = reasoningLogger.getAll();
      jsonResponse(res, { success: true, data: { decisions } });
      return;
    }

    // Agent performance metrics
    if (path === '/api/agent/performance') {
      const uptimeMs = Date.now() - agentStartTime;
      const positions = positionMonitor ? positionMonitor.getPositions() : [];
      const feeStats = feeCollector ? feeCollector.getStats() : null;

      jsonResponse(res, {
        success: true,
        data: {
          uptime: uptimeMs,
          uptimeFormatted: `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`,
          positionsMonitored: positions.length,
          rebalancesExecuted: feeStats?.totalPerformanceFeesCollected || 0,
          feesCollected: {
            deposit: feeStats?.totalDepositFeesCollected || 0,
            performance: feeStats?.totalPerformanceFeesCollected || 0,
          },
          totalValueManaged: 0, // TODO: sum position values when positions are live
        },
      });
      return;
    }

    // Positions for a wallet
    if (path === '/api/positions') {
      const query = parseQuery(url);
      const wallet = query.wallet;

      if (!wallet) {
        jsonResponse(res, { success: false, error: 'Missing wallet parameter' }, 400);
        return;
      }

      let walletPubkey: PublicKey;
      try {
        walletPubkey = new PublicKey(wallet);
      } catch {
        jsonResponse(res, { success: false, error: 'Invalid wallet address' }, 400);
        return;
      }

      const reg = await initializeRegistry();
      const adapters = reg.getAll();

      const results = await Promise.allSettled(
        adapters.map(async (adapter) => {
          try {
            const positions = await adapter.getPositions(walletPubkey);
            return positions;
          } catch (error: any) {
            console.warn(`[API] Failed to fetch positions from ${adapter.name}:`, error.message);
            return [];
          }
        })
      );

      const allPositions = results
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);

      jsonResponse(res, { success: true, data: { positions: allPositions } });
      return;
    }

    // 404 for unknown routes
    jsonResponse(res, { success: false, error: 'Not found' }, 404);

  } catch (error) {
    console.error('[API] Error:', error);
    jsonResponse(res, {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, 500);
  }
}

export async function startApiServer(): Promise<http.Server> {
  // Pre-initialize the registry
  await initializeRegistry();

  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`\n[API] Poseidon API server running on http://localhost:${PORT}`);
    console.log('[API] Endpoints:');
    console.log('  GET /health');
    console.log('  GET /api/pools?tokenA=SOL&tokenB=USDC&dex=meteora&limit=50');
    console.log('  GET /api/best-pool?tokenA=SOL&tokenB=USDC');
    console.log('  GET /api/price?symbol=SOL');
    console.log('  GET /api/prices?symbols=SOL,JUP,USDC');
    console.log('  GET /api/compare?tokenA=SOL&tokenB=USDC');
    console.log('  GET /api/fees');
    console.log('  GET /api/fees?depositAmount=1000000000  (calculate fee for 1 SOL)');
    console.log('  GET /api/migrate/analyze?pool=<addr>&dex=<dex>&value=1000');
    console.log('  GET /api/status');
    console.log('  GET /api/agent/activity');
    console.log('  GET /api/agent/reasoning');
    console.log('  GET /api/agent/performance');
    console.log('  GET /api/positions?wallet=<address>');
    console.log('');
  });

  return server;
}

// Run if executed directly
const isMain = process.argv[1]?.includes('server');
if (isMain) {
  startApiServer().catch(console.error);
}
