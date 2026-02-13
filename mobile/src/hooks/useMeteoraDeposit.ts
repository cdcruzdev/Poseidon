import { useState, useCallback } from 'react';
import { PublicKey, Keypair } from '@solana/web3.js';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import BN from 'bn.js';
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

export function useMeteoraDeposit() {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: DepositParams): Promise<DepositResult> => {
      if (!publicKey || !signTransaction) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        const poolPubkey = new PublicKey(params.poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Detect if user's token order is reversed vs pool's token order
        const poolTokenX = dlmmPool.tokenX.publicKey.toBase58();
        const isReversed = poolTokenX === params.tokenBMint;
        const xAmount = isReversed ? params.tokenBAmount : params.tokenAAmount;
        const xDecimals = isReversed ? params.tokenBDecimals : params.tokenADecimals;
        const yAmount = isReversed ? params.tokenAAmount : params.tokenBAmount;
        const yDecimals = isReversed ? params.tokenADecimals : params.tokenBDecimals;

        // Get active bin for current price context
        const activeBin = await dlmmPool.getActiveBin();
        const activeBinId = activeBin.binId;

        // Generate a keypair for the position
        const positionKeypair = Keypair.generate();

        const totalXAmount = new BN(
          Math.floor(xAmount * 10 ** xDecimals)
        );
        const totalYAmount = new BN(
          Math.floor(yAmount * 10 ** yDecimals)
        );

        // Use ±10 bins around active bin
        const minBinId = activeBinId - 10;
        const maxBinId = activeBinId + 10;

        const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
          positionPubKey: positionKeypair.publicKey,
          user: publicKey,
          totalXAmount,
          totalYAmount,
          strategy: {
            maxBinId,
            minBinId,
            strategyType: StrategyType.Spot,
          },
          slippage: params.slippageBps / 100, // expects percentage
        });

        // Set transaction properties
        tx.feePayer = publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        // Partial sign with position keypair first
        tx.partialSign(positionKeypair);

        // Sign with user wallet via MWA
        const signedTx = await signTransaction(tx);

        // Send raw transaction
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction(signature, 'confirmed');

        return {
          signature,
          positionId: positionKeypair.publicKey.toBase58(),
        };
      } catch (err: any) {
        const msg = err?.message || 'Meteora deposit failed';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction]
  );

  return { deposit, loading, error };
}
