"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Position } from "@/types/position";

const HELIUS_KEY = "a9d759b5-f465-44ec-b753-92ab3007b641";
const HELIUS_API = `https://api.helius.xyz/v0`;

// Known DEX program IDs
const DEX_PROGRAMS: Record<string, string> = {
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "Raydium",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "Meteora",
};

interface HeliusTx {
  signature: string;
  type: string;
  source: string;
  timestamp: number;
  description?: string;
  instructions?: Array<{ programId: string; accounts?: string[] }>;
  nativeTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>;
  tokenTransfers?: Array<{ fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number; tokenStandard?: string }>;
}

export function usePositions() {
  const { publicKey, connected } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!publicKey || !connected) return;
    setLoading(true);

    try {
      const wallet = publicKey.toBase58();
      
      // Fetch recent transactions from Helius enhanced API
      const res = await fetch(
        `${HELIUS_API}/addresses/${wallet}/transactions?api-key=${HELIUS_KEY}&limit=50`
      );
      const txs: HeliusTx[] = await res.json();

      const found: Position[] = [];
      const seenSigs = new Set<string>();

      for (const tx of txs) {
        if (seenSigs.has(tx.signature)) continue;

        // Method 1: Helius detected OPEN_POSITION type
        if (tx.type === "OPEN_POSITION") {
          seenSigs.add(tx.signature);
          found.push(txToPosition(tx, tx.source || "Unknown"));
          continue;
        }

        // Method 2: Check if any instruction interacts with known DEX programs
        // Skip explicit close/withdraw transactions
        if (tx.type === "CLOSE_POSITION" || tx.type === "WITHDRAW") continue;
        
        if (tx.instructions) {
          for (const ix of tx.instructions) {
            const dex = DEX_PROGRAMS[ix.programId];
            if (dex) {
              seenSigs.add(tx.signature);
              found.push(txToPosition(tx, dex));
              break;
            }
          }
        }
      }

      setPositions(found);
    } catch (err) {
      console.warn("Failed to fetch positions:", err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connected]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPositions();
    } else {
      setPositions([]);
    }
  }, [connected, publicKey, fetchPositions]);

  return { positions, loading, refetch: fetchPositions };
}

function txToPosition(tx: HeliusTx, dex: string): Position {
  // Extract token info from transfers
  const tokens = tx.tokenTransfers?.filter(t => t.tokenAmount > 0) || [];
  const tokenSymbols = tokens.length >= 2
    ? `${formatMint(tokens[0].mint)}/${formatMint(tokens[1].mint)}`
    : "LP Position";

  const solTransferred = tx.nativeTransfers
    ?.filter(t => t.fromUserAccount === tx.nativeTransfers?.[0]?.fromUserAccount)
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  return {
    id: tx.signature.slice(0, 12),
    pair: tokenSymbols,
    dex,
    deposited: solTransferred > 0 ? `${(solTransferred / 1e9).toFixed(4)} SOL` : "-",
    current: "-",
    pnl: "-",
    pnlPct: "-",
    apy: "-",
    range: "Active",
    status: "in-range",
    rebalances: 0,
    age: getAge(tx.timestamp * 1000),
    feesEarned: "-",
    nextRebalance: "Monitoring",
  };
}

function formatMint(mint: string): string {
  const KNOWN: Record<string, string> = {
    "So11111111111111111111111111111111111111112": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": "WIF",
  };
  return KNOWN[mint] || mint.slice(0, 4) + "..";
}

function getAge(timestamp: number): string {
  const ms = Date.now() - timestamp;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
