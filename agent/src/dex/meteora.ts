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
 * Meteora DLMM Adapter
 * 
 * Integrates with Meteora's Dynamic Liquidity Market Maker for concentrated liquidity.
 * 
 * Key concepts:
 * - Bins: Discrete price points (similar to ticks in Uniswap V3)
 * - Bin Step: The percentage difference between adjacent bins
 * - Active Bin: The bin where current price resides
 * - Strategy Types: Spot (uniform), Curve (concentrated), BidAsk (edges)
 */
export class MeteoraAdapter implements IDexAdapter {
  readonly dexType: DexType = 'meteora';
  readonly name = 'Meteora DLMM';

  private connection: Connection | null = null;
  private dlmmModule: any = null; // Will be dynamically imported

  // Meteora API endpoints
  private readonly API_BASE = 'https://dlmm-api.meteora.ag';

  async initialize(connection: Connection): Promise<void> {
    this.connection = connection;
    // SDK loaded lazily when needed for transactions
    // API-based reads work without SDK
    console.log('Meteora adapter initialized (API mode)');
  }

  private async loadSdkIfNeeded(): Promise<void> {
    if (this.dlmmModule) return;
    try {
      const dlmm = await import('@meteora-ag/dlmm');
      this.dlmmModule = dlmm.default || dlmm;
      console.log('Meteora DLMM SDK loaded');
    } catch (error) {
      throw new Error('Meteora SDK required for transactions. Install with: pnpm add @meteora-ag/dlmm');
    }
  }

  async findPools(tokenA: PublicKey, tokenB: PublicKey): Promise<PoolInfo[]> {
    if (!this.connection) throw new Error('Adapter not initialized');

    try {
      // Fetch all pairs from Meteora API
      const response = await fetch(`${this.API_BASE}/pair/all`);
      const pairs = await response.json() as any[];

      // Filter for the token pair (check both orderings)
      const tokenAStr = tokenA.toBase58();
      const tokenBStr = tokenB.toBase58();

      const matchingPairs = pairs.filter((pair: any) => {
        const mintX = pair.mint_x;
        const mintY = pair.mint_y;
        return (
          (mintX === tokenAStr && mintY === tokenBStr) ||
          (mintX === tokenBStr && mintY === tokenAStr)
        );
      });

      // Sort by liquidity (TVL) descending - highest liquidity first
      matchingPairs.sort((a: any, b: any) => {
        const tvlA = parseFloat(a.liquidity || 0);
        const tvlB = parseFloat(b.liquidity || 0);
        return tvlB - tvlA;
      });

      // Convert to PoolInfo format
      return matchingPairs.map((pair: any) => this.convertToPoolInfo(pair));
    } catch (error) {
      console.error('Error fetching Meteora pools:', error);
      return [];
    }
  }

  async getPoolInfo(poolAddress: PublicKey): Promise<PoolInfo> {
    if (!this.connection) throw new Error('Adapter not initialized');

    try {
      // Get pool data from API
      const response = await fetch(`${this.API_BASE}/pair/${poolAddress.toBase58()}`);
      const pairData = await response.json() as any;

      return {
        dex: 'meteora',
        address: poolAddress,
        tokenA: new PublicKey(pairData.mint_x),
        tokenB: new PublicKey(pairData.mint_y),
        tokenASymbol: pairData.name?.split('-')[0] || 'Unknown',
        tokenBSymbol: pairData.name?.split('-')[1] || 'Unknown',
        currentPrice: new Decimal(pairData.current_price || 0),
        fee: (pairData.base_fee_percentage || 0) * 100, // Convert to bps
        tvl: new Decimal(pairData.liquidity || 0),
        volume24h: new Decimal(pairData.trade_volume_24h || 0),
        apr24h: new Decimal(pairData.apr || 0),
        binStep: pairData.bin_step,
      };
    } catch (error) {
      console.error('Error getting pool info:', error);
      throw error;
    }
  }

  async getCurrentPrice(poolAddress: PublicKey): Promise<Decimal> {
    // Use API for price (no SDK needed for reads)
    const response = await fetch(`${this.API_BASE}/pair/${poolAddress.toBase58()}`);
    const pairData = await response.json() as any;
    return new Decimal(pairData.current_price || 0);
  }

  async getVolume24h(poolAddress: PublicKey): Promise<Decimal> {
    const response = await fetch(`${this.API_BASE}/pair/${poolAddress.toBase58()}`);
    const pairData = await response.json() as any;
    return new Decimal(pairData.trade_volume_24h || 0);
  }

  async getTvl(poolAddress: PublicKey): Promise<Decimal> {
    const response = await fetch(`${this.API_BASE}/pair/${poolAddress.toBase58()}`);
    const pairData = await response.json() as any;
    return new Decimal(pairData.liquidity || 0);
  }

  async createPosition(params: CreatePositionParams): Promise<TxResult> {
    if (!this.connection || !this.dlmmModule) throw new Error('Adapter not initialized');

    try {
      const dlmmPool = await this.dlmmModule.create(this.connection, params.pool);
      const activeBin = await dlmmPool.getActiveBin();

      // Convert price range to bin IDs
      const minBinId = dlmmPool.getBinIdFromPrice(params.lowerPrice.toNumber(), true);
      const maxBinId = dlmmPool.getBinIdFromPrice(params.upperPrice.toNumber(), false);

      // Create position keypair
      const positionKeypair = Keypair.generate();

      // Convert amounts to BN (assuming 9 decimals, adjust as needed)
      const totalXAmount = new BN(params.tokenAAmount.mul(1e9).toFixed(0));
      const totalYAmount = new BN(params.tokenBAmount.mul(1e9).toFixed(0));

      // Create position transaction
      const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: positionKeypair.publicKey,
        user: params.wallet.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          minBinId,
          maxBinId,
          strategyType: this.dlmmModule.StrategyType.Spot,
        },
        slippage: params.slippageBps / 100, // Convert bps to percent
      });

      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [params.wallet, positionKeypair]
      );

      return {
        success: true,
        signature,
        position: {
          id: positionKeypair.publicKey.toBase58(),
          owner: params.wallet.publicKey,
          dex: 'meteora',
          pool: params.pool,
          liquidity: new Decimal(0), // Would be calculated from response
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
    if (!this.connection || !this.dlmmModule) throw new Error('Adapter not initialized');

    try {
      // Get all positions for the pool this position belongs to
      // This is a simplified implementation - in production, you'd track the pool
      const positionInfo = await this.connection.getAccountInfo(positionAddress);
      
      if (!positionInfo) {
        return null;
      }

      // Would need to decode the position data from account info
      // For now, return null and implement fully when we have test data
      console.log('Position account found, decoding not yet implemented');
      return null;
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    if (!this.connection || !this.dlmmModule) throw new Error('Adapter not initialized');

    try {
      // Get all positions across all DLMM pools
      const allPositions = await this.dlmmModule.getAllLbPairPositionsByUser(
        this.connection,
        wallet
      );

      const positions: Position[] = [];

      allPositions.forEach((positionInfo: any, poolAddress: string) => {
        for (const pos of positionInfo.lbPairPositionsData) {
          positions.push(this.convertToPosition(pos, poolAddress, wallet));
        }
      });

      return positions;
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }

  async closePosition(params: ClosePositionParams): Promise<TxResult> {
    if (!this.connection || !this.dlmmModule) throw new Error('Adapter not initialized');

    try {
      // Get the position's pool (would need to be tracked or looked up)
      // For now, this is a placeholder
      throw new Error('closePosition requires pool address - implement position tracking');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async collectFees(params: CollectFeesParams): Promise<TxResult> {
    if (!this.connection || !this.dlmmModule) throw new Error('Adapter not initialized');

    try {
      // Would need pool address and position object
      throw new Error('collectFees requires pool context - implement position tracking');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async rebalance(params: RebalanceParams): Promise<TxResult> {
    if (!this.connection || !this.dlmmModule) throw new Error('Adapter not initialized');

    // Meteora doesn't have native rebalance - must close and reopen
    // This would:
    // 1. Remove all liquidity from old position
    // 2. Close old position
    // 3. Create new position with new range

    try {
      throw new Error('rebalance requires full position context - implement position tracking');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async buildCreatePositionTx(params: CreatePositionParams): Promise<Transaction> {
    if (!this.connection || !this.dlmmModule) throw new Error('Adapter not initialized');

    const dlmmPool = await this.dlmmModule.create(this.connection, params.pool);
    
    const minBinId = dlmmPool.getBinIdFromPrice(params.lowerPrice.toNumber(), true);
    const maxBinId = dlmmPool.getBinIdFromPrice(params.upperPrice.toNumber(), false);
    const positionKeypair = Keypair.generate();
    const totalXAmount = new BN(params.tokenAAmount.mul(1e9).toFixed(0));
    const totalYAmount = new BN(params.tokenBAmount.mul(1e9).toFixed(0));

    return dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: params.wallet.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        minBinId,
        maxBinId,
        strategyType: this.dlmmModule.StrategyType.Spot,
      },
      slippage: params.slippageBps / 100,
    });
  }

  async buildClosePositionTx(params: ClosePositionParams): Promise<Transaction> {
    throw new Error('Not implemented - requires pool context');
  }

  async buildRebalanceTx(params: RebalanceParams): Promise<Transaction> {
    throw new Error('Not implemented - requires pool context');
  }

  async estimateGas(operation: 'create' | 'close' | 'rebalance' | 'collect'): Promise<Decimal> {
    // Approximate gas costs in SOL
    switch (operation) {
      case 'create':
        return new Decimal(0.003); // ~0.003 SOL
      case 'close':
        return new Decimal(0.002); // ~0.002 SOL
      case 'rebalance':
        return new Decimal(0.005); // ~0.005 SOL (close + create)
      case 'collect':
        return new Decimal(0.001); // ~0.001 SOL
      default:
        return new Decimal(0.002);
    }
  }

  // Helper methods

  private convertToPoolInfo(pair: any): PoolInfo {
    return {
      dex: 'meteora',
      address: new PublicKey(pair.address),
      tokenA: new PublicKey(pair.mint_x),
      tokenB: new PublicKey(pair.mint_y),
      tokenASymbol: pair.name?.split('-')[0] || 'Unknown',
      tokenBSymbol: pair.name?.split('-')[1] || 'Unknown',
      currentPrice: new Decimal(pair.current_price || 0),
      fee: (pair.base_fee_percentage || 0) * 100, // Convert to bps
      tvl: new Decimal(pair.liquidity || 0),
      volume24h: new Decimal(pair.trade_volume_24h || 0),
      apr24h: new Decimal(pair.apr || 0),
      binStep: pair.bin_step,
    };
  }

  private convertToPosition(posData: any, poolAddress: string, owner: PublicKey): Position {
    return {
      id: posData.publicKey?.toBase58() || 'unknown',
      owner,
      dex: 'meteora',
      pool: new PublicKey(poolAddress),
      liquidity: new Decimal(0), // Would calculate from position data
      lowerPrice: new Decimal(0), // Would calculate from bin IDs
      upperPrice: new Decimal(0),
      tokenAAmount: new Decimal(posData.positionData?.totalXAmount || 0),
      tokenBAmount: new Decimal(posData.positionData?.totalYAmount || 0),
      unclaimedFeesA: new Decimal(posData.positionData?.feeX?.toString() || 0),
      unclaimedFeesB: new Decimal(posData.positionData?.feeY?.toString() || 0),
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
  }
}
