"use client";

import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("2ro3VBKvqtc86DJVMnZETHMGAtjYFipZwdMFgtZGWscx");

// Precomputed: first 8 bytes of sha256("global:<name>")
const IX_ENABLE = Buffer.from([94, 247, 51, 161, 142, 177, 235, 11]);
const IX_DISABLE = Buffer.from([170, 206, 89, 64, 74, 71, 94, 214]);

export interface RebalanceConfig {
  owner: PublicKey;
  enabled: boolean;
  maxSlippageBps: number;
  minYieldImprovementBps: number;
  createdAt: number;
  updatedAt: number;
}

function deserializeConfig(data: Buffer): RebalanceConfig {
  let offset = 8; // skip discriminator
  const owner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const enabled = data[offset] === 1;
  offset += 1;
  const maxSlippageBps = data.readUInt16LE(offset);
  offset += 2;
  const minYieldImprovementBps = data.readUInt16LE(offset);
  offset += 2;
  const createdAt = Number(data.readBigInt64LE(offset));
  offset += 8;
  const updatedAt = Number(data.readBigInt64LE(offset));
  return { owner, enabled, maxSlippageBps, minYieldImprovementBps, createdAt, updatedAt };
}

export function useRebalanceProgram() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const getConfigPDA = useCallback(
    (owner?: PublicKey) => {
      const key = owner ?? publicKey;
      if (!key) return null;
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rebalance"), key.toBuffer()],
        PROGRAM_ID
      );
      return pda;
    },
    [publicKey]
  );

  const fetchConfig = useCallback(async (): Promise<RebalanceConfig | null> => {
    const pda = getConfigPDA();
    if (!pda) return null;
    try {
      const info = await connection.getAccountInfo(pda);
      if (!info || !info.data || info.data.length < 61) return null;
      return deserializeConfig(Buffer.from(info.data));
    } catch {
      return null;
    }
  }, [connection, getConfigPDA]);

  const enableRebalance = useCallback(
    async (maxSlippageBps: number, minYieldBps: number): Promise<string> => {
      if (!publicKey || !sendTransaction) throw new Error("Wallet not connected");
      const pda = getConfigPDA()!;

      const data = Buffer.alloc(12);
      IX_ENABLE.copy(data, 0);
      data.writeUInt16LE(maxSlippageBps, 8);
      data.writeUInt16LE(minYieldBps, 10);

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    },
    [publicKey, sendTransaction, connection, getConfigPDA]
  );

  const disableRebalance = useCallback(async (): Promise<string> => {
    if (!publicKey || !sendTransaction) throw new Error("Wallet not connected");
    const pda = getConfigPDA()!;

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: pda, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: IX_DISABLE,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendTransaction(tx, connection);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }, [publicKey, sendTransaction, connection, getConfigPDA]);

  return {
    programId: PROGRAM_ID,
    getConfigPDA,
    fetchConfig,
    enableRebalance,
    disableRebalance,
    walletConnected: !!publicKey,
  };
}
