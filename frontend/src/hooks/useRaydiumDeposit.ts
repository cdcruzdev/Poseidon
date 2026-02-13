"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Raydium, TickUtils, PoolUtils, type ApiV3PoolInfoConcentratedItem } from "@raydium-io/raydium-sdk-v2";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import Decimal from "decimal.js";
import BN from "bn.js";

const POSEIDON_TREASURY = new PublicKey("7AGZL8i43P4LByeLn491K2TyWGqwJbeUMNCDF3QsnpRj");
const FEE_BPS = 10; // 0.1%
const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface DepositResult {
  signature: string;
  positionNftMint?: string;
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

export function useRaydiumDeposit() {
  const { connection } = useConnection();
  const { publicKey, signAllTransactions } = useWallet();
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

      if (!publicKey) throw new Error("Wallet not connected");
      if (!signAllTransactions)
        throw new Error("Wallet does not support signAllTransactions");

      setLoading(true);
      setError(null);

      try {
        // 1. Initialize Raydium SDK
        const raydium = await Raydium.load({
          connection,
          owner: publicKey,
          signAllTransactions,
          cluster: "mainnet",
          disableLoadToken: true,
        });

        // 2. Fetch pool info
        const poolData = await raydium.api.fetchPoolById({
          ids: poolAddress,
        });
        const poolInfo = poolData[0] as ApiV3PoolInfoConcentratedItem;
        if (!poolInfo) throw new Error("Pool not found");
        if (poolInfo.type !== "Concentrated") throw new Error("Pool is not a CLMM pool");

        // We need poolKeys for the open position call
        const poolKeys = await raydium.clmm.getClmmPoolKeys(poolInfo.id);

        // 3. Determine if user's token order matches pool's mintA/mintB
        const poolMintA = typeof poolInfo.mintA === 'object' && 'address' in poolInfo.mintA
          ? poolInfo.mintA.address
          : String(poolInfo.mintA);
        const isReversed = poolMintA === tokenBMint;

        // Map user amounts to pool order
        const poolAAmount = isReversed ? tokenBAmount : tokenAAmount;
        const poolADecimals = isReversed ? tokenBDecimals : tokenADecimals;

        // 3b. Calculate tick range: current price ± 10%
        const currentPrice = new Decimal(poolInfo.price);
        const priceLower = currentPrice.mul(0.9);
        const priceUpper = currentPrice.mul(1.1);

        const { tick: tickLower } = TickUtils.getPriceAndTick({
          poolInfo,
          price: priceLower,
          baseIn: true,
        });

        const { tick: tickUpper } = TickUtils.getPriceAndTick({
          poolInfo,
          price: priceUpper,
          baseIn: true,
        });

        // 4. Convert human-readable amounts to BN
        const poolBAmount = isReversed ? tokenAAmount : tokenBAmount;
        const poolBDecimals = isReversed ? tokenADecimals : tokenBDecimals;

        const amountABN = new BN(
          new Decimal(poolAAmount)
            .mul(new Decimal(10).pow(poolADecimals))
            .toFixed(0)
        );
        const amountBBN = new BN(
          new Decimal(poolBAmount)
            .mul(new Decimal(10).pow(poolBDecimals))
            .toFixed(0)
        );

        const slippage = slippageBps / 10000;

        // 5. Calculate liquidity — try A as input, check if B fits
        const epochInfo = await connection.getEpochInfo();

        const quoteFromA =
          await PoolUtils.getLiquidityAmountOutFromAmountIn({
            poolInfo,
            inputA: true,
            tickLower,
            tickUpper,
            amount: amountABN,
            slippage,
            add: true,
            epochInfo,
            amountHasFee: false,
          });

        // If token B from quote exceeds user input, flip to use B as input
        let useBase: "MintA" | "MintB";
        let baseAmount: BN;
        let otherAmountMax: BN;

        if (quoteFromA.amountSlippageB.amount.gt(amountBBN)) {
          // B would exceed — use B as constraining input
          const quoteFromB =
            await PoolUtils.getLiquidityAmountOutFromAmountIn({
              poolInfo,
              inputA: false,
              tickLower,
              tickUpper,
              amount: amountBBN,
              slippage,
              add: true,
              epochInfo,
              amountHasFee: false,
            });
          useBase = "MintB";
          baseAmount = amountBBN;
          otherAmountMax = quoteFromB.amountSlippageA.amount;
        } else {
          useBase = "MintA";
          baseAmount = amountABN;
          otherAmountMax = quoteFromA.amountSlippageB.amount;
        }

        // 6. Open position
        const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
          poolInfo,
          poolKeys,
          tickLower,
          tickUpper,
          base: useBase,
          baseAmount,
          otherAmountMax,
          ownerInfo: {
            useSOLBalance: true,
          },
          withMetadata: "create",
          txVersion: 0 as any,
        });

        // 7. Execute deposit transaction
        const { txId } = await execute({ sendAndConfirm: true });

        // 7b. Send 0.1% Poseidon fee AFTER successful deposit (can't inject into SDK tx)
        if (publicKey && signAllTransactions) {
          try {
            const feeTx = new Transaction();
            const feeA = amountABN.muln(FEE_BPS).divn(10000);
            const feeB = amountBBN.muln(FEE_BPS).divn(10000);
            const mintA = new PublicKey(isReversed ? tokenBMint : tokenAMint);
            const mintB = new PublicKey(isReversed ? tokenAMint : tokenBMint);

            for (const [mint, feeAmt] of [[mintA, feeA], [mintB, feeB]] as [PublicKey, BN][]) {
              if (feeAmt.lten(0)) continue;
              if (mint.toBase58() === SOL_MINT) {
                feeTx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: POSEIDON_TREASURY, lamports: feeAmt.toNumber() }));
              } else {
                const userAta = await getAssociatedTokenAddress(mint, publicKey);
                const treasuryAta = await getAssociatedTokenAddress(mint, POSEIDON_TREASURY);
                const acct = await connection.getAccountInfo(treasuryAta);
                if (!acct) feeTx.add(createAssociatedTokenAccountInstruction(publicKey, treasuryAta, POSEIDON_TREASURY, mint));
                feeTx.add(createTransferInstruction(userAta, treasuryAta, publicKey, BigInt(feeAmt.toString())));
              }
            }

            if (feeTx.instructions.length > 0) {
              const { blockhash } = await connection.getLatestBlockhash();
              feeTx.recentBlockhash = blockhash;
              feeTx.feePayer = publicKey;
              const [signedFee] = await signAllTransactions([feeTx]);
              await connection.sendRawTransaction(signedFee.serialize());
            }
          } catch {
            // Fee collection failed but deposit succeeded — don't throw
          }
        }

        const result: DepositResult = {
          signature: txId,
          positionNftMint: extInfo?.nftMint?.toBase58(),
        };

        return result;
      } catch (err: any) {
        const message = err?.message || "Deposit failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [connection, publicKey, signAllTransactions]
  );

  return { deposit, loading, error };
}
