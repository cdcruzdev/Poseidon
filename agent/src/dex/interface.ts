import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { DexType, PoolInfo, Position, TxResult } from '../types/index.js';

/**
 * DEX Interface
 * 
 * All DEX integrations (Meteora, Orca, Raydium) must implement this interface.
 * This enables the aggregator to treat all DEXs uniformly.
 */
export interface IDexAdapter {
  readonly dexType: DexType;
  readonly name: string;

  /**
   * Initialize the adapter with connection
   */
  initialize(connection: Connection): Promise<void>;

  /**
   * Find pools for a given token pair
   */
  findPools(
    tokenA: PublicKey,
    tokenB: PublicKey
  ): Promise<PoolInfo[]>;

  /**
   * Get detailed pool information
   */
  getPoolInfo(poolAddress: PublicKey): Promise<PoolInfo>;

  /**
   * Get current price from pool
   */
  getCurrentPrice(poolAddress: PublicKey): Promise<Decimal>;

  /**
   * Get 24h volume for a pool
   */
  getVolume24h(poolAddress: PublicKey): Promise<Decimal>;

  /**
   * Get TVL for a pool
   */
  getTvl(poolAddress: PublicKey): Promise<Decimal>;

  /**
   * Create a new LP position
   */
  createPosition(params: CreatePositionParams): Promise<TxResult>;

  /**
   * Get position details
   */
  getPosition(positionAddress: PublicKey): Promise<Position | null>;

  /**
   * Get all positions for a wallet
   */
  getPositions(wallet: PublicKey): Promise<Position[]>;

  /**
   * Close a position (withdraw all liquidity)
   */
  closePosition(params: ClosePositionParams): Promise<TxResult>;

  /**
   * Collect unclaimed fees
   */
  collectFees(params: CollectFeesParams): Promise<TxResult>;

  /**
   * Rebalance a position (close + reopen at new range)
   * Some DEXs may have native rebalance, others need close+open
   */
  rebalance(params: RebalanceParams): Promise<TxResult>;

  /**
   * Build transaction without executing (for batching/simulation)
   */
  buildCreatePositionTx(params: CreatePositionParams): Promise<Transaction>;
  buildClosePositionTx(params: ClosePositionParams): Promise<Transaction>;
  buildRebalanceTx(params: RebalanceParams): Promise<Transaction>;

  /**
   * Estimate gas cost for operations
   */
  estimateGas(operation: 'create' | 'close' | 'rebalance' | 'collect'): Promise<Decimal>;
}

/**
 * Parameters for creating a position
 */
export interface CreatePositionParams {
  pool: PublicKey;
  wallet: Keypair;
  
  // Token amounts
  tokenAAmount: Decimal;
  tokenBAmount: Decimal;
  
  // Price range
  lowerPrice: Decimal;
  upperPrice: Decimal;
  
  // Slippage tolerance (bps)
  slippageBps: number;
}

/**
 * Parameters for closing a position
 */
export interface ClosePositionParams {
  positionAddress: PublicKey;
  wallet: Keypair;
  
  // Optional: withdraw only a portion
  percentToWithdraw?: number; // 0-100
  
  // Slippage tolerance (bps)
  slippageBps: number;
}

/**
 * Parameters for collecting fees
 */
export interface CollectFeesParams {
  positionAddress: PublicKey;
  wallet: Keypair;
}

/**
 * Parameters for rebalancing
 */
export interface RebalanceParams {
  positionAddress: PublicKey;
  wallet: Keypair;
  
  // New range
  newLowerPrice: Decimal;
  newUpperPrice: Decimal;
  
  // Slippage tolerance (bps)
  slippageBps: number;
  
  // Optional: rebalance to a different pool (cross-DEX)
  newPool?: PublicKey;
}

/**
 * DEX Factory - creates appropriate adapter based on type
 */
export function createDexAdapter(dexType: DexType): IDexAdapter {
  switch (dexType) {
    case 'meteora':
      // Will be implemented after research completes
      throw new Error('Meteora adapter not yet implemented');
    case 'orca':
      throw new Error('Orca adapter not yet implemented');
    case 'raydium':
      throw new Error('Raydium adapter not yet implemented');
    default:
      throw new Error(`Unknown DEX type: ${dexType}`);
  }
}

/**
 * DEX Registry - manages all available adapters
 */
export class DexRegistry {
  private adapters: Map<DexType, IDexAdapter> = new Map();
  private connection: Connection | null = null;

  async initialize(connection: Connection) {
    this.connection = connection;
    
    // Initialize all adapters
    for (const adapter of this.adapters.values()) {
      await adapter.initialize(connection);
    }
  }

  register(adapter: IDexAdapter) {
    this.adapters.set(adapter.dexType, adapter);
  }

  get(dexType: DexType): IDexAdapter {
    const adapter = this.adapters.get(dexType);
    if (!adapter) {
      throw new Error(`No adapter registered for ${dexType}`);
    }
    return adapter;
  }

  getAll(): IDexAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Find best pool across all DEXs for a token pair
   */
  async findBestPool(
    tokenA: PublicKey,
    tokenB: PublicKey,
    criteria: 'apr' | 'tvl' | 'volume' = 'apr'
  ): Promise<{ pool: PoolInfo; adapter: IDexAdapter } | null> {
    const allPools: { pool: PoolInfo; adapter: IDexAdapter }[] = [];

    for (const adapter of this.adapters.values()) {
      try {
        const pools = await adapter.findPools(tokenA, tokenB);
        for (const pool of pools) {
          allPools.push({ pool, adapter });
        }
      } catch (error) {
        console.warn(`Failed to fetch pools from ${adapter.name}:`, error);
      }
    }

    if (allPools.length === 0) {
      return null;
    }

    // Sort by criteria
    allPools.sort((a, b) => {
      switch (criteria) {
        case 'apr':
          return b.pool.apr24h.cmp(a.pool.apr24h);
        case 'tvl':
          return b.pool.tvl.cmp(a.pool.tvl);
        case 'volume':
          return b.pool.volume24h.cmp(a.pool.volume24h);
        default:
          return 0;
      }
    });

    return allPools[0];
  }
}
