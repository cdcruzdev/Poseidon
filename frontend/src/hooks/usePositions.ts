"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import type { Position } from "@/types/position";

// Program IDs
const ORCA_WHIRLPOOL_PROGRAM = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
const RAYDIUM_CLMM_PROGRAM = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");
const METEORA_DLMM_PROGRAM = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");

// Helius RPC for DAS API
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=a9d759b5-f465-44ec-b753-92ab3007b641";

interface RawPosition {
  address: string;
  dex: string;
  data?: any;
}

export function usePositions() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!publicKey || !connected) return;
    setLoading(true);

    try {
      const rawPositions: RawPosition[] = [];

      // Fetch positions from all 3 DEXes in parallel
      const [orcaPositions, raydiumPositions, meteoraPositions] = await Promise.allSettled([
        // Orca: get positions by owner via getProgramAccounts
        connection.getProgramAccounts(ORCA_WHIRLPOOL_PROGRAM, {
          filters: [
            { dataSize: 216 }, // Orca position account size
            { memcmp: { offset: 8, bytes: publicKey.toBase58() } }, // owner at offset 8
          ],
        }).then(accounts => 
          accounts.map(a => ({ address: a.pubkey.toBase58(), dex: "Orca" }))
        ),

        // Raydium CLMM: personal position accounts
        connection.getProgramAccounts(RAYDIUM_CLMM_PROGRAM, {
          filters: [
            { dataSize: 261 }, // Raydium personal position size
            { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
          ],
        }).then(accounts =>
          accounts.map(a => ({ address: a.pubkey.toBase58(), dex: "Raydium" }))
        ),

        // Meteora DLMM: position accounts  
        connection.getProgramAccounts(METEORA_DLMM_PROGRAM, {
          filters: [
            { dataSize: 8120 }, // Meteora position size
            { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
          ],
        }).then(accounts =>
          accounts.map(a => ({ address: a.pubkey.toBase58(), dex: "Meteora" }))
        ),
      ]);

      // Collect all found positions
      if (orcaPositions.status === "fulfilled") rawPositions.push(...orcaPositions.value);
      if (raydiumPositions.status === "fulfilled") rawPositions.push(...raydiumPositions.value);
      if (meteoraPositions.status === "fulfilled") rawPositions.push(...meteoraPositions.value);

      // Map to Position type
      const mapped: Position[] = rawPositions.map((p, i) => ({
        id: p.address,
        pair: "LP Position",
        dex: p.dex,
        deposited: "-",
        current: "-",
        pnl: "-",
        pnlPct: "-",
        apy: "-",
        range: "Active",
        status: "in-range" as const,
        rebalances: 0,
        age: "New",
        feesEarned: "-",
        nextRebalance: "Monitoring",
      }));

      setPositions(mapped);
    } catch (err) {
      console.warn("Failed to fetch positions:", err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connected, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPositions();
    } else {
      setPositions([]);
    }
  }, [connected, publicKey, fetchPositions]);

  return { positions, loading, refetch: fetchPositions };
}
