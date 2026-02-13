"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  PriceMath,
  increaseLiquidityQuoteByInputTokenWithParams,
  TokenExtensionUtil,
} from "@orca-so/whirlpools-sdk";
import { Percentage } from "@orca-so/common-sdk";
import BN from "bn.js";
import Decimal from "decimal.js";

export interface DepositResult {
  signature: string;
  positionMint?: string;
}

export interface DepositParams {
  poolAddress: string;
  tokenAAmount: number;
  tokenBAmount: number;
  tokenADecimals: number;
  tokenBDecimals: number;
  tokenAMint: string;
  tokenBMint: string;
  slippageBps: number;
}

export function useOrcaDeposit() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: DepositParams): Promise<DepositResult> => {
      const {
        poolAddress,
        tokenAAmount,
        tokenBAmount,
        tokenADecimals,
        tokenBDecimals,
        tokenAMint,
        tokenBMint,
        slippageBps,
      } = params;

      if (!wallet) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        // Build Anchor provider & Whirlpool client
        const provider = new AnchorProvider(connection, wallet, {
          commitment: "confirmed",
        });
        const ctx = WhirlpoolContext.withProvider(provider);
        const client = buildWhirlpoolClient(ctx);

        // Fetch pool
        const poolPubkey = new PublicKey(poolAddress);
        const whirlpool = await client.getPool(poolPubkey);
        const poolData = whirlpool.getData();
        const tickSpacing = poolData.tickSpacing;

        // Determine if user's token order matches pool's token order
        const userAMatchesPoolA = poolData.tokenMintA.toBase58() === tokenAMint;
        const userAMatchesPoolB = poolData.tokenMintB.toBase58() === tokenAMint;
        if (!userAMatchesPoolA && !userAMatchesPoolB) {
          throw new Error("User's token A does not match either pool token");
        }
        const isReversed = userAMatchesPoolB;

        // Map user amounts to pool's token order
        const poolTokenAAmount = isReversed ? tokenBAmount : tokenAAmount;
        const poolTokenADecimals = isReversed ? tokenBDecimals : tokenADecimals;
        const poolTokenBDecimals = isReversed ? tokenADecimals : tokenBDecimals;

        // Current price from sqrt_price (always use pool's decimals)
        const currentPrice = PriceMath.sqrtPriceX64ToPrice(
          poolData.sqrtPrice,
          poolTokenADecimals,
          poolTokenBDecimals
        );

        // Calculate tick range: ±5% around current price (tighter = less token ratio skew)
        const priceLower = currentPrice.mul(new Decimal(0.95));
        const priceUpper = currentPrice.mul(new Decimal(1.05));

        const tickLower = PriceMath.priceToInitializableTickIndex(
          priceLower,
          poolTokenADecimals,
          poolTokenBDecimals,
          tickSpacing
        );
        const tickUpper = PriceMath.priceToInitializableTickIndex(
          priceUpper,
          poolTokenADecimals,
          poolTokenBDecimals,
          tickSpacing
        );

        // Convert human amounts to native BN (using pool's token A)
        const tokenAmountA = new BN(
          new Decimal(poolTokenAAmount)
            .mul(new Decimal(10).pow(poolTokenADecimals))
            .floor()
            .toString()
        );

        const slippage = Percentage.fromFraction(slippageBps, 10000);

        // Build liquidity quote using pool's token A as input
        const tokenExtensionCtx =
          await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            poolData
          );

        const quote = increaseLiquidityQuoteByInputTokenWithParams({
          inputTokenMint: poolData.tokenMintA,
          inputTokenAmount: tokenAmountA,
          tokenMintA: poolData.tokenMintA,
          tokenMintB: poolData.tokenMintB,
          tickLowerIndex: tickLower,
          tickUpperIndex: tickUpper,
          sqrtPrice: poolData.sqrtPrice,
          tickCurrentIndex: poolData.tickCurrentIndex,
          slippageTolerance: slippage,
          tokenExtensionCtx,
        });

        if (!signAllTransactions) {
          throw new Error("Wallet does not support signAllTransactions");
        }

        // Initialize tick arrays if needed
        const initTxBuilder = await whirlpool.initTickArrayForTicks(
          [tickLower, tickUpper]
        );

        // Open position with liquidity
        const { positionMint, tx: openTxBuilder } = await whirlpool.openPosition(
          tickLower,
          tickUpper,
          quote
        );

        // Build all transactions and collect signers
        const transactionsToSign: (Transaction | VersionedTransaction)[] = [];
        const allSignerSets: { tx: Transaction; signers: any[] }[] = [];

        if (initTxBuilder) {
          const built = await initTxBuilder.build();
          allSignerSets.push({ tx: built.transaction as Transaction, signers: built.signers });
        }

        const openBuilt = await openTxBuilder.build();
        allSignerSets.push({ tx: openBuilt.transaction as Transaction, signers: openBuilt.signers });

        // Set recent blockhash and fee payer, then partial-sign with any keypair signers
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        for (const { tx: builtTx, signers } of allSignerSets) {
          if ('recentBlockhash' in builtTx) {
            // Legacy Transaction
            builtTx.recentBlockhash = blockhash;
            builtTx.feePayer = wallet.publicKey;
            if (signers.length > 0) {
              builtTx.partialSign(...signers);
            }
          } else if ('message' in builtTx) {
            // VersionedTransaction - signers need to sign directly
            if (signers.length > 0) {
              (builtTx as any).sign(signers);
            }
          }
          transactionsToSign.push(builtTx);
        }

        // Single wallet prompt for all transactions
        const signedTxs = await signAllTransactions(transactionsToSign);

        // Send transactions sequentially, confirming each before the next.
        // The init tick array tx MUST be confirmed before the open position tx.
        let signature = "";
        for (let i = 0; i < signedTxs.length; i++) {
          const rawTx = signedTxs[i].serialize();
          const txSig = await connection.sendRawTransaction(rawTx, {
            skipPreflight: false,
          });
          // Confirm every transaction before sending the next one
          await connection.confirmTransaction(
            { signature: txSig, blockhash, lastValidBlockHeight },
            "confirmed"
          );
          signature = txSig;
        }

        return {
          signature,
          positionMint: positionMint.toBase58(),
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to deposit into Orca pool";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet, signAllTransactions]
  );

  return { deposit, loading, error };
}
