import { useState, useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  PriceMath,
  increaseLiquidityQuoteByInputTokenWithParams,
  TickUtil,
  PDAUtil,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  WhirlpoolIx,
  TokenExtensionUtil,
} from '@orca-so/whirlpools-sdk';
import { Percentage } from '@orca-so/common-sdk';
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

function createAnchorWallet(
  publicKey: PublicKey,
  signTransaction: Function,
  signAllTransactions: Function
) {
  return {
    publicKey,
    signTransaction: signTransaction as any,
    signAllTransactions: signAllTransactions as any,
  };
}

export function useOrcaDeposit() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: DepositParams): Promise<DepositResult> => {
      if (!publicKey || !signTransaction || !signAllTransactions) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        const anchorWallet = createAnchorWallet(publicKey, signTransaction, signAllTransactions);
        const provider = new AnchorProvider(connection, anchorWallet, {
          commitment: 'confirmed',
        });

        const ctx = WhirlpoolContext.withProvider(provider);
        const client = buildWhirlpoolClient(ctx);

        const poolPubkey = new PublicKey(params.poolAddress);
        const whirlpool = await client.getPool(poolPubkey);
        const whirlpoolData = whirlpool.getData();
        const tickSpacing = whirlpoolData.tickSpacing;

        // Detect if user's token order is reversed vs pool's token order
        const userAMatchesPoolA = whirlpoolData.tokenMintA.toBase58() === params.tokenAMint;
        const isReversed = !userAMatchesPoolA;
        const poolADecimals = isReversed ? params.tokenBDecimals : params.tokenADecimals;
        const poolBDecimals = isReversed ? params.tokenADecimals : params.tokenBDecimals;
        const poolAAmount = isReversed ? params.tokenBAmount : params.tokenAAmount;

        // Get current price
        const currentPrice = PriceMath.sqrtPriceX64ToPrice(
          whirlpoolData.sqrtPrice,
          poolADecimals,
          poolBDecimals
        );

        // Calculate ±10% tick range
        const lowerPrice = currentPrice.mul(new Decimal(0.9));
        const upperPrice = currentPrice.mul(new Decimal(1.1));

        const tickLower = PriceMath.priceToInitializableTickIndex(
          lowerPrice,
          poolADecimals,
          poolBDecimals,
          tickSpacing
        );

        const tickUpper = PriceMath.priceToInitializableTickIndex(
          upperPrice,
          poolADecimals,
          poolBDecimals,
          tickSpacing
        );

        // Determine input token and amount
        const inputTokenMint = whirlpoolData.tokenMintA;
        const inputAmount = new BN(
          Math.floor(poolAAmount * 10 ** poolADecimals)
        );

        const slippage = Percentage.fromFraction(params.slippageBps, 10000);

        const quote = increaseLiquidityQuoteByInputTokenWithParams({
          tokenMintA: whirlpoolData.tokenMintA,
          tokenMintB: whirlpoolData.tokenMintB,
          sqrtPrice: whirlpoolData.sqrtPrice,
          tickCurrentIndex: whirlpoolData.tickCurrentIndex,
          tickLowerIndex: tickLower,
          tickUpperIndex: tickUpper,
          inputTokenMint,
          inputTokenAmount: inputAmount,
          slippageTolerance: slippage,
          tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            whirlpoolData
          ),
        });

        // Initialize tick arrays if needed
        const tickArrayLowerPda = PDAUtil.getTickArrayFromTickIndex(
          tickLower,
          tickSpacing,
          poolPubkey,
          ORCA_WHIRLPOOL_PROGRAM_ID
        );
        const tickArrayUpperPda = PDAUtil.getTickArrayFromTickIndex(
          tickUpper,
          tickSpacing,
          poolPubkey,
          ORCA_WHIRLPOOL_PROGRAM_ID
        );

        for (const pda of [tickArrayLowerPda, tickArrayUpperPda]) {
          const info = await connection.getAccountInfo(pda.publicKey);
          if (!info) {
            // Use the correct tick index for each array's start tick
            const tickForArray = pda === tickArrayLowerPda ? tickLower : tickUpper;
            const initIx = WhirlpoolIx.initTickArrayIx(ctx.program, {
              whirlpool: poolPubkey,
              tickArrayPda: pda,
              startTick: TickUtil.getStartTickIndex(tickForArray, tickSpacing),
              funder: publicKey,
            });
            const tx = new Transaction().add(...initIx.instructions);
            tx.feePayer = publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            const signed = await signTransaction(tx);
            await connection.sendRawTransaction(signed.serialize());
          }
        }

        // Open position
        const { tx: openTx, positionMint } = await whirlpool.openPosition(
          tickLower,
          tickUpper,
          quote
        );

        const signature = await openTx.buildAndExecute();

        return {
          signature,
          positionId: positionMint.toBase58(),
        };
      } catch (err: any) {
        const msg = err?.message || 'Orca deposit failed';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, signAllTransactions]
  );

  return { deposit, loading, error };
}
