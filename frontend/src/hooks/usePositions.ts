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
      
      // Fetch SOL price, pool yields, and transactions in parallel
      if (!cachedSolPrice) cachedSolPrice = await fetchSolPrice();
      const solPrice = cachedSolPrice;

      // Fetch pool yields from agent API for 24h yield display
      const yieldsByDex: Record<string, number> = {};
      try {
        const poolRes = await fetch("http://localhost:3001/api/pools?tokenA=SOL&tokenB=USDC&limit=10");
        const poolJson = await poolRes.json();
        if (poolJson.success) {
          for (const pool of poolJson.data || []) {
            const dex = pool.dex?.toLowerCase();
            const y = pool.yield24h ?? ((pool.apr24h || pool.estimatedApr || 0) / 365);
            if (dex && y > 0) yieldsByDex[dex] = y;
          }
        }
      } catch {}

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
          found.push(txToPosition(tx, tx.source || "Unknown", solPrice, yieldsByDex));
          continue;
        }

        // Method 2: Check if any instruction interacts with known DEX programs
        if (tx.type === "CLOSE_POSITION" || tx.type === "WITHDRAW") continue;
        
        if (tx.instructions) {
          for (const ix of tx.instructions) {
            const dex = DEX_PROGRAMS[ix.programId];
            if (dex) {
              seenSigs.add(tx.signature);
              found.push(txToPosition(tx, dex, solPrice, yieldsByDex));
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

async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const data = await res.json();
    return data.solana?.usd || 190;
  } catch {
    return 190;
  }
}

let cachedSolPrice = 0;

function extractDexAddresses(tx: HeliusTx, dex: string): { positionMint?: string; positionAddress?: string; poolAddress?: string } {
  const dexLower = dex.toLowerCase();
  const dexProgram = dexLower === "orca" ? "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
    : dexLower === "raydium" ? "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
    : "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

  const ix = tx.instructions?.find(i => i.programId === dexProgram);
  if (!ix?.accounts) return {};

  if (dexLower === "orca") {
    // [funder, owner, position, positionMint, positionTokenAccount, whirlpool, ...]
    return { positionAddress: ix.accounts[2], positionMint: ix.accounts[3], poolAddress: ix.accounts[5] };
  } else if (dexLower === "raydium") {
    // [payer, owner, poolState, positionNftOwner, positionNftMint, ...]
    return { poolAddress: ix.accounts[2], positionMint: ix.accounts[4] };
  } else {
    // Meteora: [position, lbPair, ...]
    return { positionAddress: ix.accounts[0], poolAddress: ix.accounts[1] };
  }
}

function txToPosition(tx: HeliusTx, dex: string, solPrice: number, yieldsByDex: Record<string, number>): Position {
  // Use TOKEN transfers only (includes wrapped SOL). Skip NFT mints.
  const wallet = tx.nativeTransfers?.[0]?.fromUserAccount || "";
  const deposits = tx.tokenTransfers?.filter(t => {
    if (t.tokenAmount <= 0) return false;
    if (t.tokenAmount === 1 && !KNOWN_MINTS[t.mint]) return false;
    return t.fromUserAccount === wallet;
  }) || [];

  // Build pair from deposited tokens
  const symbols: string[] = [];
  let totalUsd = 0;

  for (const d of deposits) {
    const sym = formatMint(d.mint);
    if (!symbols.includes(sym)) symbols.push(sym);

    // Calculate USD
    if (STABLES.includes(d.mint)) {
      totalUsd += d.tokenAmount;
    } else if (d.mint === "So11111111111111111111111111111111111111112") {
      totalUsd += d.tokenAmount * solPrice;
    }
  }

  const pair = symbols.length >= 2 ? `${symbols[0]}/${symbols[1]}` : symbols.length === 1 ? `${symbols[0]}/...` : "LP Position";

  // Get 24h yield for this DEX
  const dexKey = dex.toLowerCase();
  const yield24h = yieldsByDex[dexKey] || 0;
  const yieldStr = yield24h > 0 ? `${yield24h.toFixed(3)}%` : "-";

  const addrs = extractDexAddresses(tx, dex);

  return {
    id: tx.signature,
    txSignature: tx.signature,
    positionMint: addrs.positionMint,
    positionAddress: addrs.positionAddress,
    poolAddress: addrs.poolAddress,
    pair,
    dex,
    deposited: totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "-",
    current: totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "-",
    pnl: "$0.00",
    pnlPct: "0.0%",
    apy: yieldStr,
    range: "Active",
    status: "in-range",
    rebalances: 0,
    age: getAge(tx.timestamp * 1000),
    feesEarned: "$0.00",
    nextRebalance: "Monitoring",
  };
}

const STABLES = [
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
];

const KNOWN_MINTS: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "SOL",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": "WIF",
};

function formatMint(mint: string): string {
  return KNOWN_MINTS[mint] || mint.slice(0, 4) + "..";
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
