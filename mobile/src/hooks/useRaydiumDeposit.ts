import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  Raydium,
  PoolUtils,
  ApiV3PoolInfoConcentratedItem,
} from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import Decimal from 'decimal.js';
import { useWallet } from '../contexts/WalletContext';
import { connection } from '../lib/connection';

interface DepositResult {
  signature: string;
  positionId?: string;
}

interface DepositParams {
  poolAddress: string;
  tokenAAmount: number;
  tokenBAmount: number;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenAMint: string;
  tokenBMint: string;
  slippageBps: number;
}

export function useRaydiumDeposit() {
  const { publicKey, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: DepositParams): Promise<DepositResult> => {
      if (!publicKey || !signAllTransactions) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        const raydium = await Raydium.load({
          connection,
          owner: publicKey,
          signAllTransactions,
          cluster: 'mainnet',
          disableLoadToken: true,
        });

        // Fetch pool info
        const poolData = await raydium.api.fetchPoolById({
          ids: params.poolAddress,
        });
        const poolInfo = poolData[0] as ApiV3PoolInfoConcentratedItem;

        if (!poolInfo || poolInfo.type !== 'Concentrated') {
          throw new Error('Pool is not a concentrated liquidity pool');
        }

        const epochInfo = await connection.getEpochInfo();

        // Calculate tick range (±10% from current price)
        const currentPrice = new Decimal(poolInfo.price);
        const lowerPrice = currentPrice.mul(0.9);
        const upperPrice = currentPrice.mul(1.1);

        // Detect if user's token order is reversed vs pool's token order
        const poolMintA = typeof poolInfo.mintA === 'object' && 'address' in poolInfo.mintA
          ? poolInfo.mintA.address : String(poolInfo.mintA);
        const isReversed = poolMintA === params.tokenBMint;
        const poolAAmount = isReversed ? params.tokenBAmount : params.tokenAAmount;
        const poolADecimals = isReversed ? params.tokenBDecimals : params.tokenADecimals;

        // Use pool's token A as base input
        const inputAmount = new BN(
          Math.floor(poolAAmount * 10 ** poolADecimals)
        );

        const { liquidity, amountSlippageA, amountSlippageB } =
          await PoolUtils.getLiquidityAmountOutFromAmountIn({
            poolInfo,
            inputA: true,
            tickLower: Math.floor(
              Math.log(lowerPrice.toNumber()) / Math.log(1.0001)
            ),
            tickUpper: Math.ceil(
              Math.log(upperPrice.toNumber()) / Math.log(1.0001)
            ),
            amount: inputAmount,
            slippage: params.slippageBps / 10000,
            add: true,
            epochInfo,
            amountHasFee: false,
          });

        const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
          poolInfo,
          poolKeys: poolInfo as any,
          tickLower: Math.floor(
            Math.log(lowerPrice.toNumber()) / Math.log(1.0001)
          ),
          tickUpper: Math.ceil(
            Math.log(upperPrice.toNumber()) / Math.log(1.0001)
          ),
          base: 'MintA',
          baseAmount: inputAmount,
          otherAmountMax: amountSlippageB.amount,
          ownerInfo: {
            useSOLBalance: true,
          },
        });

        const { txId } = await execute({ sendAndConfirm: true });

        return {
          signature: txId,
          positionId: extInfo?.nftMint?.toBase58(),
        };
      } catch (err: any) {
        const msg = err?.message || 'Raydium deposit failed';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signAllTransactions]
  );

  return { deposit, loading, error };
}
