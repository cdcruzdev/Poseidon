"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
} from "@solana/web3.js";

const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=a9d759b5-f465-44ec-b753-92ab3007b641";
const connection = new Connection(HELIUS_RPC, "confirmed");
const POSEIDON_PROGRAM = new PublicKey("HLsgAVzjjBaBR9QCLqV3vjC9LTnR2xtmtB77j1EJQBsZ");

// Anchor discriminators: sha256("global:<method>")[0..8]
const ENABLE_DISC = Buffer.from([0x5e, 0xf7, 0x33, 0xa1, 0x8e, 0xb1, 0xeb, 0x0b]);
const DISABLE_DISC = Buffer.from([0xaa, 0xce, 0x59, 0x40, 0x4a, 0x47, 0x5e, 0xd6]);

export function useRebalanceToggle() {
  const { publicKey, signTransaction } = useWallet();
  const [toggling, setToggling] = useState<string | null>(null);

  const toggle = useCallback(
    async (positionMint: string, currentlyEnabled: boolean): Promise<boolean> => {
      if (!publicKey || !signTransaction) return currentlyEnabled;

      setToggling(positionMint);
      try {
        const mintPubkey = new PublicKey(positionMint);
        const [configPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("rebalance"), publicKey.toBuffer(), mintPubkey.toBuffer()],
          POSEIDON_PROGRAM,
        );

        let data: Buffer;
        let keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];

        if (currentlyEnabled) {
          // disable_rebalance: accounts = [owner, config_pda, position_mint]
          data = DISABLE_DISC;
          keys = [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: mintPubkey, isSigner: false, isWritable: false },
          ];
        } else {
          // enable_rebalance: accounts = [owner, config_pda, position_mint, system_program]
          const args = Buffer.alloc(4);
          args.writeUInt16LE(100, 0); // 1% max slippage
          args.writeUInt16LE(50, 2);  // 0.5% min yield improvement
          data = Buffer.concat([ENABLE_DISC, args]);
          keys = [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: mintPubkey, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ];
        }

        const { blockhash } = await connection.getLatestBlockhash();
        const message = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: [
            {
              programId: POSEIDON_PROGRAM,
              keys,
              data,
            },
          ],
        }).compileToV0Message();

        const tx = new VersionedTransaction(message);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, "confirmed");

        return !currentlyEnabled;
      } catch (err) {
        console.error("Rebalance toggle failed:", err);
        return currentlyEnabled;
      } finally {
        setToggling(null);
      }
    },
    [publicKey, signTransaction],
  );

  return { toggle, toggling };
}
