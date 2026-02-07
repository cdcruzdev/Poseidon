import { Connection, PublicKey, Transaction, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import Decimal from 'decimal.js';
import BN from 'bn.js';
import {
  IDexAdapter,
  CreatePositionParams,
  ClosePositionParams,
  CollectFeesParams,
  RebalanceParams,
} from './interface.js';
import { DexType, PoolInfo, Position, TxResult } from '../types/index.js';

/**
 * Orca Whirlpools Adapter
 * 
 * Integrates with Orca's Whirlpools for concentrated liquidity.
 * 
 * Key concepts:
 * - Ticks: Price points in the pool (similar to Uniswap V3)
 * - Tick Spacing: Minimum distance between position boundaries
 * - Whirlpool: The pool contract itself
 * - Position: NFT representing your liquidity
 */
export class OrcaAdapter implements IDexAdapter {
  readonly dexType: DexType = 'orca';
  readonly name = 'Orca Whirlpools';

  private connection: Connection | null = null;
  private whirlpoolModule: any = null;

  // Orca API endpoints
  private readonly API_BASE = 'https://api.mainnet.orca.so';

  // Whirlpool program IDs
  private readonly WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

  async initialize(connection: Connection): Promise<void> {
    this.connection = connection;
    console.log('Orca adapter initialized (API mode)');
    
    // Pre-warm the pool cache in background (don't await)
    this.getPoolList().catch(err => {
      console.warn('[Orca] Background cache warm-up failed:', err.message);
    });
  }

  private async loadSdkIfNeeded(): Promise<void> {
    if (this.whirlpoolModule) return;
    try {
      const orca = await import('@orca-so/whirlpools-sdk');
      this.whirlpoolModule = orca;
      console.log('Orca Whirlpools SDK loaded');
    } catch (error) {
      throw new Error('Orca SDK required for transactions. Install with: pnpm add @orca-so/whirlpools-sdk');
    }
  }

  // Cache for pool list (18MB response, cache for 10 min)
  private poolCache: { data: any[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private cacheLoading: Promise<any[]> | null = null; // Prevent concurrent fetches

  private async getPoolList(): Promise<any[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.poolCache && (now - this.poolCache.timestamp) < this.CACHE_TTL) {
      return this.poolCache.data;
    }

    // If already loading, wait for that instead of starting another request
    if (this.cacheLoading) {
      return this.cacheLoading;
    }

    // Start loading
    this.cacheLoading = this.fetchPoolList();
    
    try {
      const pools = await this.cacheLoading;
      return pools;
    } finally {
      this.cacheLoading = null;
    }
  }

  private async fetchPoolList(): Promise<any[]> {
    console.log('[Orca] Fetching pool list (18MB, please wait ~30s)...');
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.API_BASE}/v1/whirlpool/list`, {
        signal: AbortSignal.timeout(90000), // 90 second timeout
      });
      
      if (!response.ok) {
        console.error(`[Orca] API returned ${response.status}`);
        return [];
      }
      
      const data = await response.json() as any;
      const pools = data.whirlpools || [];
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Orca] Cached ${pools.length} pools (took ${elapsed}s)`);
      
      this.poolCache = { data: pools, timestamp: Date.now() };
      return pools;
    } catch (error: any) {
      console.error(`[Orca] Failed to fetch pools: ${error.message}`);
      // Return empty array but don't cache failure
      return [];
    }
  }

  async findPools(tokenA: PublicKey, tokenB: PublicKey): Promise<PoolInfo[]> {
    if (!this.connection) throw new Error('Adapter not initialized');

    try {
      const tokenAStr = tokenA.toBase58();
      const tokenBStr = tokenB.toBase58();

      const allPools = await this.getPoolList();

      // Filter for matching pairs
      const matchingPools = allPools.filter((pool: any) => {
        const mintA = pool.tokenA?.mint;
        const mintB = pool.tokenB?.mint;
        return (
          (mintA === tokenAStr && mintB === tokenBStr) ||
          (mintA === tokenBStr && mintB === tokenAStr)
        );
      });

      console.log(`[Orca] Found ${matchingPools.length} pools for ${tokenAStr.slice(0,4)}.../${tokenBStr.slice(0,4)}...`);

      // Sort by TVL descending
      matchingPools.sort((a: any, b: any) => parseFloat(b.tvl || 0) - parseFloat(a.tvl || 0));

      // Return top 10 pools for this pair
      const result = matchingPools.slice(0, 10).map((pool: any) => this.convertToPoolInfo(pool));
      return result;
    } catch (error: any) {
      console.error('[Orca] Error fetching pools:', error.message);
      return [];
    }
  }

  async getPoolInfo(poolAddress: PublicKey): Promise<PoolInfo> {
    if (!this.connection) throw new Error('Adapter not initialized');

    try {
      // Use API for pool info
      const response = await fetch(`${this.API_BASE}/v1/whirlpool/${poolAddress.toBase58()}`);
      const data = await response.json() as any;

      return {
        dex: 'orca',
        address: poolAddress,
        tokenA: new PublicKey(data.tokenA?.mint || data.tokenMintA),
        tokenB: new PublicKey(data.tokenB?.mint || data.tokenMintB),
        tokenASymbol: data.tokenA?.symbol || 'Unknown',
        tokenBSymbol: data.tokenB?.symbol || 'Unknown',
        currentPrice: new Decimal(data.price || 0),
        fee: (data.feeRate || 0) / 100, // Convert to bps
        tvl: new Decimal(data.tvl || 0),
        volume24h: new Decimal(data.volume?.day || 0),
        apr24h: new Decimal(data.apr || data.feeApr || 0),
        tickSpacing: data.tickSpacing,
      };
    } catch (error) {
      console.error('Error getting pool info:', error);
      throw error;
    }
  }

  async getCurrentPrice(poolAddress: PublicKey): Promise<Decimal> {
    try {
      const response = await fetch(`${this.API_BASE}/v1/whirlpool/${poolAddress.toBase58()}`);
      const data = await response.json() as any;
      return new Decimal(data.price || 0);
    } catch {
      return new Decimal(0);
    }
  }

  async getVolume24h(poolAddress: PublicKey): Promise<Decimal> {
    try {
      const response = await fetch(`${this.API_BASE}/v1/whirlpool/${poolAddress.toBase58()}/stats`);
      const stats = await response.json() as any;
      return new Decimal(stats.volume24h || 0);
    } catch {
      return new Decimal(0);
    }
  }

  async getTvl(poolAddress: PublicKey): Promise<Decimal> {
    try {
      const response = await fetch(`${this.API_BASE}/v1/whirlpool/${poolAddress.toBase58()}`);
      const data = await response.json() as any;
      return new Decimal(data.tvl || 0);
    } catch {
      return new Decimal(0);
    }
  }

  async createPosition(params: CreatePositionParams): Promise<TxResult> {
    if (!this.connection || !this.whirlpoolModule) throw new Error('Adapter not initialized');

    try {
      const {
        WhirlpoolContext,
        buildWhirlpoolClient,
        ORCA_WHIRLPOOL_PROGRAM_ID,
        PriceMath,
        increaseLiquidityQuoteByInputToken,
        TickUtil,
      } = this.whirlpoolModule;

      // Create context with wallet
      const ctx = WhirlpoolContext.from(
        this.connection,
        { publicKey: params.wallet.publicKey, signTransaction: async (tx: Transaction) => tx },
        ORCA_WHIRLPOOL_PROGRAM_ID
      );
      const client = buildWhirlpoolClient(ctx);

      // Get pool
      const pool = await client.getPool(params.pool);
      const poolData = pool.getData();

      // Convert prices to ticks
      const lowerTick = TickUtil.getInitializableTickIndex(
        PriceMath.priceToTickIndex(params.lowerPrice.toNumber(), poolData.tokenMintA.decimals, poolData.tokenMintB.decimals),
        poolData.tickSpacing
      );
      const upperTick = TickUtil.getInitializableTickIndex(
        PriceMath.priceToTickIndex(params.upperPrice.toNumber(), poolData.tokenMintA.decimals, poolData.tokenMintB.decimals),
        poolData.tickSpacing
      );

      // Get quote for liquidity
      const quote = increaseLiquidityQuoteByInputToken(
        poolData.tokenMintA,
        params.tokenAAmount.mul(10 ** 9).toFixed(0), // Assuming 9 decimals
        lowerTick,
        upperTick,
        params.slippageBps / 10000, // Convert bps to percentage
        pool
      );

      // Open position
      const { positionMint, tx } = await pool.openPosition(
        lowerTick,
        upperTick,
        quote
      );

      // Build and send transaction
      const builtTx = await tx.build();
      const signature = await sendAndConfirmTransaction(
        this.connection,
        builtTx.transaction,
        [params.wallet, ...builtTx.signers]
      );

      return {
        success: true,
        signature,
        position: {
          id: positionMint.toBase58(),
          owner: params.wallet.publicKey,
          dex: 'orca',
          pool: params.pool,
          liquidity: new Decimal(quote.liquidityAmount.toString()),
          lowerPrice: params.lowerPrice,
          upperPrice: params.upperPrice,
          tokenAAmount: params.tokenAAmount,
          tokenBAmount: params.tokenBAmount,
          unclaimedFeesA: new Decimal(0),
          unclaimedFeesB: new Decimal(0),
          status: 'active',
          strategy: {
            autoRebalance: true,
            privacyEnabled: false,
            maxSlippageBps: params.slippageBps,
            minRebalanceInterval: 300,
          },
          createdAt: Date.now(),
          isPrivate: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getPosition(positionAddress: PublicKey): Promise<Position | null> {
    if (!this.connection || !this.whirlpoolModule) throw new Error('Adapter not initialized');

    try {
      const { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID } = this.whirlpoolModule;
      
      const ctx = WhirlpoolContext.from(
        this.connection,
        {} as any,
        ORCA_WHIRLPOOL_PROGRAM_ID
      );
      const client = buildWhirlpoolClient(ctx);

      const position = await client.getPosition(positionAddress);
      if (!position) return null;

      const posData = position.getData();
      
      return {
        id: positionAddress.toBase58(),
        owner: posData.positionMint, // Position NFT holder
        dex: 'orca',
        pool: posData.whirlpool,
        liquidity: new Decimal(posData.liquidity.toString()),
        lowerPrice: new Decimal(0), // Would calculate from ticks
        upperPrice: new Decimal(0),
        tokenAAmount: new Decimal(0), // Would calculate
        tokenBAmount: new Decimal(0),
        unclaimedFeesA: new Decimal(posData.feeOwedA?.toString() || 0),
        unclaimedFeesB: new Decimal(posData.feeOwedB?.toString() || 0),
        status: 'active',
        strategy: {
          autoRebalance: true,
          privacyEnabled: false,
          maxSlippageBps: 100,
          minRebalanceInterval: 300,
        },
        createdAt: Date.now(),
        isPrivate: false,
      };
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    if (!this.connection || !this.whirlpoolModule) throw new Error('Adapter not initialized');

    try {
      const { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID } = this.whirlpoolModule;
      
      const ctx = WhirlpoolContext.from(
        this.connection,
        {} as any,
        ORCA_WHIRLPOOL_PROGRAM_ID
      );
      const client = buildWhirlpoolClient(ctx);

      // Get all positions for wallet
      const positions = await client.getPositions(wallet);
      
      return positions.map((pos: any) => ({
        id: pos.address.toBase58(),
        owner: wallet,
        dex: 'orca' as DexType,
        pool: pos.getData().whirlpool,
        liquidity: new Decimal(pos.getData().liquidity.toString()),
        lowerPrice: new Decimal(0),
        upperPrice: new Decimal(0),
        tokenAAmount: new Decimal(0),
        tokenBAmount: new Decimal(0),
        unclaimedFeesA: new Decimal(pos.getData().feeOwedA?.toString() || 0),
        unclaimedFeesB: new Decimal(pos.getData().feeOwedB?.toString() || 0),
        status: 'active' as const,
        strategy: {
          autoRebalance: true,
          privacyEnabled: false,
          maxSlippageBps: 100,
          minRebalanceInterval: 300,
        },
        createdAt: Date.now(),
        isPrivate: false,
      }));
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }

  async closePosition(params: ClosePositionParams): Promise<TxResult> {
    if (!this.connection || !this.whirlpoolModule) throw new Error('Adapter not initialized');

    try {
      // Orca requires: decrease liquidity to 0, collect fees, then close
      // This is a simplified implementation
      throw new Error('closePosition requires full position context - implement with position bundle');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async collectFees(params: CollectFeesParams): Promise<TxResult> {
    if (!this.connection || !this.whirlpoolModule) throw new Error('Adapter not initialized');

    try {
      throw new Error('collectFees requires position bundle context');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rebalance(params: RebalanceParams): Promise<TxResult> {
    // Orca also requires close + reopen for rebalancing
    // No native "change range" function
    try {
      throw new Error('rebalance requires full position context - implement as close+open');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async buildCreatePositionTx(params: CreatePositionParams): Promise<Transaction> {
    throw new Error('Not implemented - use createPosition directly');
  }

  async buildClosePositionTx(params: ClosePositionParams): Promise<Transaction> {
    throw new Error('Not implemented');
  }

  async buildRebalanceTx(params: RebalanceParams): Promise<Transaction> {
    throw new Error('Not implemented');
  }

  async estimateGas(operation: 'create' | 'close' | 'rebalance' | 'collect'): Promise<Decimal> {
    switch (operation) {
      case 'create':
        return new Decimal(0.004); // Orca positions cost slightly more
      case 'close':
        return new Decimal(0.003);
      case 'rebalance':
        return new Decimal(0.007); // close + create
      case 'collect':
        return new Decimal(0.001);
      default:
        return new Decimal(0.002);
    }
  }

  private convertToPoolInfo(pool: any): PoolInfo {
    // Orca API returns volume and APR as nested objects: { day, week, month }
    const volume24h = pool.volume?.day || pool.volume24h || 0;
    const apr24h = pool.feeApr?.day || pool.totalApr?.day || pool.apr24h || 0;
    
    return {
      dex: 'orca',
      address: new PublicKey(pool.address),
      tokenA: new PublicKey(pool.tokenA?.mint || PublicKey.default),
      tokenB: new PublicKey(pool.tokenB?.mint || PublicKey.default),
      tokenASymbol: pool.tokenA?.symbol || 'Unknown',
      tokenBSymbol: pool.tokenB?.symbol || 'Unknown',
      currentPrice: new Decimal(pool.price || 0),
      fee: pool.lpFeeRate ? Math.round(pool.lpFeeRate * 10000) : 0, // lpFeeRate is decimal (0.003 = 0.3%), convert to bps
      tvl: new Decimal(pool.tvl || 0),
      volume24h: new Decimal(volume24h),
      apr24h: new Decimal(apr24h),
      tickSpacing: pool.tickSpacing,
    };
  }
}
