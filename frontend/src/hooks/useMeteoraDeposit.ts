"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

const POSEIDON_TREASURY = new PublicKey("7AGZL8i43P4LByeLn491K2TyWGqwJbeUMNCDF3QsnpRj");
const FEE_BPS = 10; // 0.1%
const SOL_MINT = "So11111111111111111111111111111111111111112";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import BN from "bn.js";
import Decimal from "decimal.js";

interface DepositResult {
  signature: string;
  positionAddress?: string;
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

export default function useMeteoraDeposit() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
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
      if (!sendTransaction) throw new Error("Wallet does not support sending transactions");

      setLoading(true);
      setError(null);

      try {
        // Load the DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get active bin for price reference
        const activeBin = await dlmmPool.getActiveBin();
        const activeBinId = activeBin.binId;

        // Generate position keypair
        const positionKeypair = Keypair.generate();

        // Determine if user's token order matches pool's token order (X/Y)
        const poolTokenX = dlmmPool.tokenX.publicKey.toBase58();
        const isReversed = poolTokenX === tokenBMint;

        // Map user amounts to pool's X/Y order
        const xAmount = isReversed ? tokenBAmount : tokenAAmount;
        const xDecimals = isReversed ? tokenBDecimals : tokenADecimals;
        const yAmount = isReversed ? tokenAAmount : tokenBAmount;
        const yDecimals = isReversed ? tokenADecimals : tokenBDecimals;

        // Convert human-readable amounts to native units
        // Reduce amounts by 2% buffer to account for Meteora bin rent (~0.05 SOL)
        // and ATA creation costs. This ensures wallet never shows more than UI.
        const METEORA_BUFFER = 0.98;
        const totalXAmount = new BN(
          new Decimal(xAmount)
            .mul(METEORA_BUFFER)
            .mul(new Decimal(10).pow(xDecimals))
            .floor()
            .toFixed(0)
        );
        const totalYAmount = new BN(
          new Decimal(yAmount)
            .mul(METEORA_BUFFER)
            .mul(new Decimal(10).pow(yDecimals))
            .floor()
            .toFixed(0)
        );

        // Bin range: ±10 bins around active bin
        const minBinId = activeBinId - 10;
        const maxBinId = activeBinId + 10;

        // Create the add liquidity transaction
        const createPositionTx =
          await dlmmPool.initializePositionAndAddLiquidityByStrategy({
            positionPubKey: positionKeypair.publicKey,
            totalXAmount,
            totalYAmount,
            strategy: {
              maxBinId,
              minBinId,
              strategyType: StrategyType.Spot,
            },
            user: publicKey,
            slippage: slippageBps / 100,
          });

        // Add 0.1% Poseidon fee instructions
        const feeX = new BN(totalXAmount.muln(FEE_BPS).divn(10000).toString());
        const feeY = new BN(totalYAmount.muln(FEE_BPS).divn(10000).toString());
        const poolMintX = dlmmPool.tokenX.publicKey;
        const poolMintY = dlmmPool.tokenY.publicKey;

        for (const [mint, feeAmt] of [[poolMintX, feeX], [poolMintY, feeY]] as [PublicKey, BN][]) {
          if (feeAmt.lten(0)) continue;
          if (mint.toBase58() === SOL_MINT) {
            createPositionTx.add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: POSEIDON_TREASURY, lamports: feeAmt.toNumber() }));
          } else {
            const userAta = await getAssociatedTokenAddress(mint, publicKey);
            const treasuryAta = await getAssociatedTokenAddress(mint, POSEIDON_TREASURY);
            const acct = await connection.getAccountInfo(treasuryAta);
            if (!acct) createPositionTx.add(createAssociatedTokenAccountInstruction(publicKey, treasuryAta, POSEIDON_TREASURY, mint));
            createPositionTx.add(createTransferInstruction(userAta, treasuryAta, publicKey, BigInt(feeAmt.toString())));
          }
        }

        // Set transaction metadata
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        createPositionTx.feePayer = publicKey;
        createPositionTx.recentBlockhash = blockhash;

        // Position keypair must partial-sign BEFORE wallet signs
        createPositionTx.partialSign(positionKeypair);

        // Send via wallet adapter (wallet signs + sends)
        const signature = await sendTransaction(createPositionTx, connection);

        // Confirm via polling (more resilient than confirmTransaction)
        let confirmed = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise(r => setTimeout(r, 1500));
          const resp = await connection.getSignatureStatus(signature);
          const status = resp?.value;
          if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
            if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
            confirmed = true;
            break;
          }
        }
        if (!confirmed) throw new Error("Transaction confirmation timed out. Check Solscan for status.");

        // Persist the position keypair to localStorage so the user can manage/close
        // the position later. The keypair is required to sign withdrawal transactions
        // and is NOT recoverable from the blockchain.
        localStorage.setItem(
          `meteora-position-${positionKeypair.publicKey.toBase58()}`,
          JSON.stringify(Array.from(positionKeypair.secretKey))
        );

        return {
          signature,
          positionAddress: positionKeypair.publicKey.toBase58(),
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Meteora deposit failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [connection, publicKey, sendTransaction]
  );

  return { deposit, loading, error };
}
