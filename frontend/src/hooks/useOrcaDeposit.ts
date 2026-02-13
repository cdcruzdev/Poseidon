"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Transaction, VersionedTransaction, SystemProgram } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

const POSEIDON_TREASURY = new PublicKey("7AGZL8i43P4LByeLn491K2TyWGqwJbeUMNCDF3QsnpRj");
const FEE_BPS = 10; // 0.1%
const SOL_MINT = "So11111111111111111111111111111111111111112";
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

        // Calculate tick range: ±10% around current price
        const priceLower = currentPrice.mul(new Decimal(0.9));
        const priceUpper = currentPrice.mul(new Decimal(1.1));

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

        // Convert human amounts to native BN
        const poolTokenBAmount = isReversed ? tokenAAmount : tokenBAmount;

        const tokenAmountABN = new BN(
          new Decimal(poolTokenAAmount)
            .mul(new Decimal(10).pow(poolTokenADecimals))
            .floor()
            .toString()
        );
        const tokenAmountBBN = new BN(
          new Decimal(poolTokenBAmount)
            .mul(new Decimal(10).pow(poolTokenBDecimals))
            .floor()
            .toString()
        );

        const slippage = Percentage.fromFraction(slippageBps, 10000);

        const tokenExtensionCtx =
          await TokenExtensionUtil.buildTokenExtensionContext(
            ctx.fetcher,
            poolData
          );

        // Try token A as input first
        const quoteFromA = increaseLiquidityQuoteByInputTokenWithParams({
          inputTokenMint: poolData.tokenMintA,
          inputTokenAmount: tokenAmountABN,
          tokenMintA: poolData.tokenMintA,
          tokenMintB: poolData.tokenMintB,
          tickLowerIndex: tickLower,
          tickUpperIndex: tickUpper,
          sqrtPrice: poolData.sqrtPrice,
          tickCurrentIndex: poolData.tickCurrentIndex,
          slippageTolerance: slippage,
          tokenExtensionCtx,
        });

        // Check if token B from quote exceeds user's input — if so, use token B as input
        const quoteBMax = quoteFromA.tokenMaxB;
        let quote;
        if (quoteBMax.gt(tokenAmountBBN)) {
          // Token B would exceed — use B as constraining input instead
          quote = increaseLiquidityQuoteByInputTokenWithParams({
            inputTokenMint: poolData.tokenMintB,
            inputTokenAmount: tokenAmountBBN,
            tokenMintA: poolData.tokenMintA,
            tokenMintB: poolData.tokenMintB,
            tickLowerIndex: tickLower,
            tickUpperIndex: tickUpper,
            sqrtPrice: poolData.sqrtPrice,
            tickCurrentIndex: poolData.tickCurrentIndex,
            slippageTolerance: slippage,
            tokenExtensionCtx,
          });
        } else {
          quote = quoteFromA;
        }

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
        const openTx = openBuilt.transaction as Transaction;

        // Inject 0.1% Poseidon fee instructions INTO the deposit tx (atomic)
        const feeAmountA = new BN(tokenAmountABN.muln(FEE_BPS).divn(10000).toString());
        const feeAmountB = new BN(tokenAmountBBN.muln(FEE_BPS).divn(10000).toString());
        const mintA = isReversed ? new PublicKey(tokenBMint) : new PublicKey(tokenAMint);
        const mintB = isReversed ? new PublicKey(tokenAMint) : new PublicKey(tokenBMint);

        for (const [mint, feeAmt] of [[mintA, feeAmountA], [mintB, feeAmountB]] as [PublicKey, BN][]) {
          if (feeAmt.lten(0)) continue;
          if (mint.toBase58() === SOL_MINT) {
            openTx.add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: POSEIDON_TREASURY, lamports: feeAmt.toNumber() }));
          } else {
            const userAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
            const treasuryAta = await getAssociatedTokenAddress(mint, POSEIDON_TREASURY);
            const acct = await connection.getAccountInfo(treasuryAta);
            if (!acct) openTx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, treasuryAta, POSEIDON_TREASURY, mint));
            openTx.add(createTransferInstruction(userAta, treasuryAta, wallet.publicKey, BigInt(feeAmt.toString())));
          }
        }

        allSignerSets.push({ tx: openTx, signers: openBuilt.signers });

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
          // Poll signature status with retry (more resilient than confirmTransaction)
          let confirmed = false;
          for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise(r => setTimeout(r, 1500));
            const resp = await connection.getSignatureStatus(txSig);
            const status = resp?.value;
            if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
              if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
              confirmed = true;
              break;
            }
          }
          if (!confirmed) throw new Error("Transaction confirmation timed out. Check Solscan for status.");
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
