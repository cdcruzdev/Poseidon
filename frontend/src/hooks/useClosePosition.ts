"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  PDAUtil,
  collectFeesQuote,
  decreaseLiquidityQuoteByLiquidityWithParams,
  TokenExtensionUtil,
} from "@orca-so/whirlpools-sdk";
import { Percentage } from "@orca-so/common-sdk";
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import type { Position } from "@/types/position";

const POSEIDON_TREASURY = new PublicKey("7AGZL8i43P4LByeLn491K2TyWGqwJbeUMNCDF3QsnpRj");
const REBALANCE_FEE_BPS = 500; // 5% of earned fees

export function useClosePosition() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closePosition = useCallback(async (position: Position): Promise<string> => {
    if (!wallet || !signAllTransactions) throw new Error("Wallet not connected");
    
    setLoading(true);
    setError(null);

    try {
      const dex = position.dex.toLowerCase();

      if (dex === "orca") {
        return await closeOrcaPosition(position);
      } else {
        // For Raydium/Meteora, redirect to native UI for now
        // Full SDK close requires more complex setup
        throw new Error(`Close position via ${position.dex} UI`);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet, signAllTransactions, connection]);

  const closeOrcaPosition = useCallback(async (position: Position): Promise<string> => {
    if (!wallet || !signAllTransactions || !position.positionMint || !position.poolAddress) {
      throw new Error("Missing position data for close");
    }

    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const ctx = WhirlpoolContext.withProvider(provider);
    const client = buildWhirlpoolClient(ctx);

    const positionMintPubkey = new PublicKey(position.positionMint);
    const poolPubkey = new PublicKey(position.poolAddress);

    // Fetch pool and position data
    const whirlpool = await client.getPool(poolPubkey);
    const poolData = whirlpool.getData();

    const positionPDA = PDAUtil.getPosition(ctx.program.programId, positionMintPubkey);
    const positionAccount = await client.getPosition(positionPDA.publicKey);
    const positionData = positionAccount.getData();

    const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(
      ctx.fetcher, poolData
    );

    // 1. Decrease liquidity to 0 (withdraw all)
    const slippage = Percentage.fromFraction(100, 10000); // 1%
    const decreaseQuote = decreaseLiquidityQuoteByLiquidityWithParams({
      liquidity: positionData.liquidity,
      sqrtPrice: poolData.sqrtPrice,
      tickLowerIndex: positionData.tickLowerIndex,
      tickUpperIndex: positionData.tickUpperIndex,
      tickCurrentIndex: poolData.tickCurrentIndex,
      slippageTolerance: slippage,
      tokenExtensionCtx,
    });

    // 2. Collect fees quote
    const feesQuote = collectFeesQuote({
      whirlpool: poolData,
      position: positionData,
      tickLower: await ctx.fetcher.getTickArray(
        PDAUtil.getTickArray(ctx.program.programId, poolPubkey, positionData.tickLowerIndex).publicKey
      ) as any,
      tickUpper: await ctx.fetcher.getTickArray(
        PDAUtil.getTickArray(ctx.program.programId, poolPubkey, positionData.tickUpperIndex).publicKey
      ) as any,
      tokenExtensionCtx,
    });

    // Build close transaction using SDK
    const closeTxBuilder = await positionAccount.closePosition(
      slippage,
      undefined, // destinationWallet (defaults to owner)
      undefined, // positionWallet
      undefined, // payer
    );

    const closeTx = (await closeTxBuilder.build()).transaction as Transaction;

    // 3. Add 5% performance fee on earned fees (if auto-rebalance was on)
    // For hackathon: always deduct 5% of collected fees as Poseidon performance fee
    // In production, would check if auto-rebalance was enabled for this position
    const feeTokenA = feesQuote.feeOwedA;
    const feeTokenB = feesQuote.feeOwedB;
    
    if (feeTokenA.gtn(0) || feeTokenB.gtn(0)) {
      const perfFeeA = feeTokenA.muln(REBALANCE_FEE_BPS).divn(10000);
      const perfFeeB = feeTokenB.muln(REBALANCE_FEE_BPS).divn(10000);

      const mintA = poolData.tokenMintA;
      const mintB = poolData.tokenMintB;

      for (const [mint, feeAmt] of [[mintA, perfFeeA], [mintB, perfFeeB]] as [PublicKey, any][]) {
        if (!feeAmt || feeAmt.lten(0)) continue;
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        if (mint.toBase58() === SOL_MINT) {
          closeTx.add(SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: POSEIDON_TREASURY,
            lamports: feeAmt.toNumber(),
          }));
        } else {
          const userAta = await getAssociatedTokenAddress(mint, wallet.publicKey);
          const treasuryAta = await getAssociatedTokenAddress(mint, POSEIDON_TREASURY);
          const acct = await connection.getAccountInfo(treasuryAta);
          if (!acct) {
            closeTx.add(createAssociatedTokenAccountInstruction(
              wallet.publicKey, treasuryAta, POSEIDON_TREASURY, mint
            ));
          }
          closeTx.add(createTransferInstruction(
            userAta, treasuryAta, wallet.publicKey, BigInt(feeAmt.toString())
          ));
        }
      }
    }

    // Set blockhash and sign
    const { blockhash } = await connection.getLatestBlockhash();
    closeTx.recentBlockhash = blockhash;
    closeTx.feePayer = wallet.publicKey;

    const [signedTx] = await signAllTransactions([closeTx]);
    const rawTx = signedTx.serialize();
    const signature = await connection.sendRawTransaction(rawTx, { skipPreflight: false });

    // Poll confirmation
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const resp = await connection.getSignatureStatus(signature);
      const status = resp?.value;
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        if (status.err) throw new Error(`Close failed: ${JSON.stringify(status.err)}`);
        return signature;
      }
    }
    throw new Error("Close confirmation timed out. Check explorer.");
  }, [connection, wallet, signAllTransactions]);

  return { closePosition, loading, error };
}
