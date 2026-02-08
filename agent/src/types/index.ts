import { PublicKey } from '@solana/web3.js';
import type { Decimal } from 'decimal.js';

// Supported DEXs
export type DexType = 'meteora' | 'orca' | 'raydium';

// Pool type within a DEX
export type PoolType = 'DLMM' | 'DAMM_V2' | 'Whirlpool' | 'CLMM' | 'unknown';

// Position status
export type PositionStatus = 'active' | 'out_of_range' | 'closed' | 'pending';

// Rebalance trigger types
export type RebalanceTrigger = 'price_exit' | 'yield_target' | 'time_based' | 'manual';

// User strategy configuration
export interface StrategyConfig {
  // Target daily yield percentage (e.g., 0.4 for 0.4%)
  targetDailyYield?: number;
  
  // Manual range bounds (if not using yield target)
  lowerPrice?: Decimal;
  upperPrice?: Decimal;
  
  // Auto-rebalance settings
  autoRebalance: boolean;
  
  // Privacy mode
  privacyEnabled: boolean;
  
  // Max slippage tolerance for rebalancing (bps)
  maxSlippageBps: number;
  
  // Minimum time between rebalances (seconds)
  minRebalanceInterval: number;
}

// Pool information from any DEX
export interface PoolInfo {
  dex: DexType;
  address: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  tokenASymbol: string;
  tokenBSymbol: string;
  currentPrice: Decimal;
  fee: number; // basis points
  tvl: Decimal;
  volume24h: Decimal;
  apr24h: Decimal;
  tickSpacing?: number; // for concentrated liquidity
  binStep?: number; // for Meteora DLMM
  poolType?: PoolType; // e.g. DLMM, DAMM_V2, Whirlpool, CLMM
}

// User position
export interface Position {
  id: string;
  owner: PublicKey;
  dex: DexType;
  pool: PublicKey;
  
  // Position details
  liquidity: Decimal;
  lowerPrice: Decimal;
  upperPrice: Decimal;
  
  // Token amounts
  tokenAAmount: Decimal;
  tokenBAmount: Decimal;
  
  // Fees earned
  unclaimedFeesA: Decimal;
  unclaimedFeesB: Decimal;
  
  // Status
  status: PositionStatus;
  
  // Strategy
  strategy: StrategyConfig;
  
  // Timestamps
  createdAt: number;
  lastRebalanceAt?: number;
  
  // Privacy (if enabled, these are encrypted references)
  isPrivate: boolean;
  encryptedRef?: string;
}

// Rebalance decision
export interface RebalanceDecision {
  shouldRebalance: boolean;
  trigger?: RebalanceTrigger;
  reason?: string;
  
  // New range if rebalancing
  newLowerPrice?: Decimal;
  newUpperPrice?: Decimal;
  
  // Estimated costs and benefits
  estimatedGasCost?: Decimal; // in SOL
  estimatedBenefit?: Decimal; // in USD
  
  // Risk score (0-100)
  riskScore?: number;
}

// DEX aggregation result
export interface AggregationResult {
  pools: PoolInfo[];
  bestPool: PoolInfo;
  
  // For a given amount and strategy, optimal allocation
  recommendedDex: DexType;
  expectedApr: Decimal;
  
  // Range recommendation based on strategy
  recommendedLower: Decimal;
  recommendedUpper: Decimal;
}

// Transaction result
export interface TxResult {
  success: boolean;
  signature?: string;
  error?: string;
  
  // Position details after tx
  position?: Position;
}

// Agent configuration
export interface AgentConfig {
  // RPC endpoints
  rpcUrl: string;
  wsUrl?: string;
  
  // Wallet
  walletPath: string;
  
  // Monitoring
  priceCheckIntervalMs: number;
  
  // Arcium (privacy)
  arciumEnabled: boolean;
  arciumCluster?: string;
  
  // Fees
  depositFeeBps: number; // 0.1% = 10 bps
  performanceFeeBps: number; // 5% = 500 bps
}

// Price feed
export interface PriceFeed {
  tokenA: string;
  tokenB: string;
  price: Decimal;
  timestamp: number;
  source: 'pyth' | 'switchboard' | 'dex';
}

// Yield calculation input
export interface YieldCalcInput {
  targetDailyYield: number; // percentage
  currentPrice: Decimal;
  volatility24h: Decimal; // standard deviation
  poolFee: number; // bps
  volume24h: Decimal;
  tvl: Decimal;
}

// Yield calculation output
export interface YieldCalcOutput {
  recommendedLower: Decimal;
  recommendedUpper: Decimal;
  rangeWidthPercent: Decimal;
  estimatedDailyYield: Decimal;
  estimatedRebalancesPerDay: number;
  confidence: number; // 0-100
}
