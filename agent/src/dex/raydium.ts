import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { sendTransaction } from '../wallet/send-tx.js';
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
 * Raydium CLMM Adapter
 * 
 * Integrates with Raydium's Concentrated Liquidity pools.
 * 
 * Key concepts:
 * - Tick: Price point (similar to Uniswap V3)
 * - Fee Tiers: 0.01%, 0.05%, 0.25%, 1%
 * - Position: NFT representing your liquidity
 */
export class RaydiumAdapter implements IDexAdapter {
  readonly dexType: DexType = 'raydium';
  readonly name = 'Raydium CLMM';

  private connection: Connection | null = null;
  private raydiumModule: any = null;

  // Raydium API
  private readonly API_BASE = 'https://api-v3.raydium.io';

  // Program IDs
  private readonly CLMM_PROGRAM_ID = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');

  async initialize(connection: Connection): Promise<void> {
    this.connection = connection;
    // SDK loaded lazily when needed for transactions
    console.log('Raydium adapter initialized (API mode)');
  }

  private async loadSdkIfNeeded(): Promise<void> {
    if (this.raydiumModule) return;
    try {
      const raydium = await import('@raydium-io/raydium-sdk-v2');
      this.raydiumModule = raydium;
      console.log('Raydium SDK loaded');
    } catch (error) {
      throw new Error('Raydium SDK required for transactions. Install with: pnpm add @raydium-io/raydium-sdk-v2');
    }
  }

  async findPools(tokenA: PublicKey, tokenB: PublicKey): Promise<PoolInfo[]> {
    if (!this.connection) throw new Error('Adapter not initialized');

    try {
      // Use Raydium API to find CLMM pools
      const tokenAStr = tokenA.toBase58();
      const tokenBStr = tokenB.toBase58();
      
      const response = await fetch(
        `${this.API_BASE}/pools/info/mint?mint1=${tokenAStr}&mint2=${tokenBStr}&poolType=all&poolSortField=default&sortType=desc&pageSize=100&page=1`,
        { signal: AbortSignal.timeout(15000) }
      );
      const data = await response.json() as any;
      console.log(`[Raydium] Found ${data.data?.data?.length || 0} pools for ${tokenAStr.slice(0,4)}.../${tokenBStr.slice(0,4)}...`);

      if (!data.success || !data.data?.data) {
        return [];
      }

      // Filter for concentrated liquidity pools only
      const clmmPools = data.data.data.filter((p: any) => p.type === 'Concentrated');
      return clmmPools.map((pool: any) => this.convertToPoolInfo(pool));
    } catch (error) {
      console.error('Error fetching Raydium pools:', error);
      return [];
    }
  }

  async getPoolInfo(poolAddress: PublicKey): Promise<PoolInfo> {
    if (!this.connection) throw new Error('Adapter not initialized');

    try {
      const response = await fetch(`${this.API_BASE}/pools/info/ids?ids=${poolAddress.toBase58()}`);
      const data = await response.json() as any;

      if (!data.success || !data.data?.[0]) {
        throw new Error('Pool not found');
      }

      return this.convertToPoolInfo(data.data[0]);
    } catch (error) {
      console.error('Error getting pool info:', error);
      throw error;
    }
  }

  async getCurrentPrice(poolAddress: PublicKey): Promise<Decimal> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    return poolInfo.currentPrice;
  }

  async getVolume24h(poolAddress: PublicKey): Promise<Decimal> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    return poolInfo.volume24h;
  }

  async getTvl(poolAddress: PublicKey): Promise<Decimal> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    return poolInfo.tvl;
  }

  async createPosition(params: CreatePositionParams): Promise<TxResult> {
    if (!this.connection || !this.raydiumModule) throw new Error('Adapter not initialized');

    try {
      const { Raydium, TxVersion } = this.raydiumModule;

      // Initialize Raydium SDK
      const raydium = await Raydium.load({
        connection: this.connection,
        owner: params.wallet,
        cluster: 'mainnet', // or 'devnet'
      });

      // Fetch pool info
      const poolInfo = await raydium.clmm.getPoolInfoFromRpc(params.pool.toBase58());

      // Convert prices to ticks
      const { TickUtils } = this.raydiumModule;
      const lowerTick = TickUtils.getTickWithPriceAndTickspacing({
        price: params.lowerPrice.toNumber(),
        tickSpacing: poolInfo.tickSpacing,
        baseIn: true,
      });
      const upperTick = TickUtils.getTickWithPriceAndTickspacing({
        price: params.upperPrice.toNumber(),
        tickSpacing: poolInfo.tickSpacing,
        baseIn: true,
      });

      // Open position
      const { execute, transaction } = await raydium.clmm.openPositionFromBase({
        poolInfo,
        tickLower: lowerTick,
        tickUpper: upperTick,
        base: 'MintA', // or 'MintB'
        baseAmount: new BN(params.tokenAAmount.mul(1e9).toFixed(0)),
        otherAmountMax: new BN(params.tokenBAmount.mul(1e9).mul(1 + params.slippageBps / 10000).toFixed(0)),
        txVersion: TxVersion.V0,
      });

      // Execute transaction
      const { txIds } = await execute();
      const signature = txIds[0];

      return {
        success: true,
        signature,
        position: {
          id: signature, // Would get actual position address from tx result
          owner: params.wallet.publicKey,
          dex: 'raydium',
          pool: params.pool,
          liquidity: new Decimal(0),
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
    if (!this.connection || !this.raydiumModule) throw new Error('Adapter not initialized');

    try {
      // Would need to decode position account data
      // Raydium positions are NFTs
      const accountInfo = await this.connection.getAccountInfo(positionAddress);
      if (!accountInfo) return null;

      // Placeholder - full implementation would decode the position data
      return null;
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    if (!this.connection || !this.raydiumModule) throw new Error('Adapter not initialized');

    try {
      const { Raydium } = this.raydiumModule;

      const raydium = await Raydium.load({
        connection: this.connection,
        owner: wallet,
        cluster: 'mainnet',
      });

      // Get all CLMM positions
      const positions = await raydium.clmm.getOwnerPositionInfo({
        programId: this.CLMM_PROGRAM_ID,
      });

      return positions.map((pos: any) => ({
        id: pos.nftMint?.toBase58() || 'unknown',
        owner: wallet,
        dex: 'raydium' as DexType,
        pool: pos.poolId,
        liquidity: new Decimal(pos.liquidity?.toString() || 0),
        lowerPrice: new Decimal(0), // Would calculate from ticks
        upperPrice: new Decimal(0),
        tokenAAmount: new Decimal(pos.amountA?.toString() || 0),
        tokenBAmount: new Decimal(pos.amountB?.toString() || 0),
        unclaimedFeesA: new Decimal(pos.tokenFeeAmountA?.toString() || 0),
        unclaimedFeesB: new Decimal(pos.tokenFeeAmountB?.toString() || 0),
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
    if (!this.connection || !this.raydiumModule) throw new Error('Adapter not initialized');

    try {
      // Raydium: decreaseLiquidity to 0, then closePosition
      throw new Error('closePosition requires position context');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async collectFees(params: CollectFeesParams): Promise<TxResult> {
    if (!this.connection || !this.raydiumModule) throw new Error('Adapter not initialized');

    try {
      throw new Error('collectFees requires position context');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rebalance(params: RebalanceParams): Promise<TxResult> {
    // Raydium CLMM ranges are immutable - must close and reopen
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
        return new Decimal(0.003);
      case 'close':
        return new Decimal(0.002);
      case 'rebalance':
        return new Decimal(0.005);
      case 'collect':
        return new Decimal(0.001);
      default:
        return new Decimal(0.002);
    }
  }

  private convertToPoolInfo(pool: any): PoolInfo {
    // Handle both old and new API formats
    const mintAAddr = typeof pool.mintA === 'object' ? pool.mintA?.address : pool.mintA;
    const mintBAddr = typeof pool.mintB === 'object' ? pool.mintB?.address : pool.mintB;
    const mintASymbol = typeof pool.mintA === 'object' ? pool.mintA?.symbol : pool.mintSymbolA;
    const mintBSymbol = typeof pool.mintB === 'object' ? pool.mintB?.symbol : pool.mintSymbolB;
    
    return {
      dex: 'raydium',
      address: new PublicKey(pool.id || pool.poolId),
      tokenA: new PublicKey(mintAAddr || pool.baseMint),
      tokenB: new PublicKey(mintBAddr || pool.quoteMint),
      tokenASymbol: mintASymbol || pool.baseSymbol || 'Unknown',
      tokenBSymbol: mintBSymbol || pool.quoteSymbol || 'Unknown',
      currentPrice: new Decimal(pool.price || 0),
      fee: (pool.feeRate || 0) * 10000, // Convert from decimal to bps
      tvl: new Decimal(pool.tvl || 0),
      volume24h: new Decimal(pool.day?.volume || pool.volume24h || 0),
      apr24h: new Decimal(pool.day?.apr || pool.apr24h || 0),
      tickSpacing: pool.config?.tickSpacing || pool.ammConfig?.tickSpacing || pool.tickSpacing || 1,
      poolType: 'CLMM',
    };
  }

  private getFeeFromConfigId(configId: string | undefined): number {
    // Raydium fee tier mapping (in bps)
    const feeTiers: Record<string, number> = {
      // 0.01%
      'CJPEDoTJEZjjEQ8yrPADrTKMN88HrVH3ybFw7FxJMdVQ': 1,
      // 0.05%
      'AjTzAqRfj1nChU6VqcKqw4MhPzJnqKZmKJLMnT8EMJXD': 5,
      // 0.25%
      '2fGXL8uhqxJ4tpgtosHZXT4zcQap6j62z3qMDbUk4GpQ': 25,
      // 1%
      'E64NGkDLLCdQ2yFNPcavaKptrEgmiQaNykUuLC1Qgwyp': 100,
    };

    return feeTiers[configId || ''] || 25; // Default to 0.25%
  }
}
