"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { PDAUtil, ORCA_WHIRLPOOL_PROGRAM_ID, PriceMath, PoolUtil } from "@orca-so/whirlpools-sdk";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import type { Position } from "@/types/position";
import BN from "bn.js";

// Use RPC proxy in browser (full URL required by Connection class), env var for SSR/build
function getRpcUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/rpc`;
  }
  return process.env.HELIUS_RPC_URL || "https://mainnet.helius-rpc.com";
}
const connection = new Connection(getRpcUrl(), "confirmed");

const KNOWN_MINTS: Record<string, { symbol: string; decimals: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", decimals: 9 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", decimals: 6 },
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": { symbol: "JUP", decimals: 6 },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", decimals: 5 },
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": { symbol: "WIF", decimals: 6 },
};

const STABLES = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

const RAYDIUM_CLMM = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");
const POSEIDON_PROGRAM = new PublicKey("HLsgAVzjjBaBR9QCLqV3vjC9LTnR2xtmtB77j1EJQBsZ");

// Fetch wallet-level rebalance config (current on-chain program uses ["rebalance", owner] seeds)
async function fetchRebalanceEnabled(wallet: PublicKey): Promise<boolean> {
  try {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rebalance"), wallet.toBuffer()],
      POSEIDON_PROGRAM,
    );
    const info = await connection.getAccountInfo(configPda);
    if (!info || info.data.length < 41) return false;
    // Current layout: disc(8) + owner(32) + enabled(1)
    return info.data[40] === 1;
  } catch {
    return false;
  }
}
const METEORA_DLMM = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");

let cachedSolPrice = 0;
let solPriceTimestamp = 0;

async function fetchSolPrice(): Promise<number> {
  if (cachedSolPrice > 0 && Date.now() - solPriceTimestamp < 60_000) return cachedSolPrice;
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const data = await res.json();
    if (typeof data.solana?.usd === "number" && data.solana.usd > 0) {
      cachedSolPrice = data.solana.usd;
      solPriceTimestamp = Date.now();
      return cachedSolPrice;
    }
  } catch {}
  return cachedSolPrice || 190;
}

// Pool stats cache: { [poolAddress]: { volume24h, feeRate, activeLiquidity } }
interface PoolStats {
  volume24h: number;
  feeRate: number;
  feeAprDay: number; // Pool-wide daily fee APR as decimal (0.59 = 59%)
  tvl: number;
}
let cachedOrcaPools: Map<string, PoolStats> | null = null;
let cachedRaydiumPools: Map<string, PoolStats> | null = null;
let poolStatsCacheTime = 0;

async function fetchPoolStats(): Promise<{ orca: Map<string, PoolStats>; raydium: Map<string, PoolStats> }> {
  if (cachedOrcaPools && cachedRaydiumPools && Date.now() - poolStatsCacheTime < 120_000) {
    return { orca: cachedOrcaPools, raydium: cachedRaydiumPools };
  }

  const orcaMap = new Map<string, PoolStats>();
  const raydiumMap = new Map<string, PoolStats>();

  // Fetch Orca pool data
  try {
    const res = await fetch("https://api.mainnet.orca.so/v1/whirlpool/list", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    for (const pool of data.whirlpools || []) {
      if (pool.volume?.day && pool.lpFeeRate) {
        orcaMap.set(pool.address, {
          volume24h: pool.volume.day,
          feeRate: pool.lpFeeRate,
          feeAprDay: pool.feeApr?.day || 0,
          tvl: pool.tvl || 0,
        });
      }
    }
  } catch {}

  // Fetch Raydium pool data
  try {
    const res = await fetch("https://api-v3.raydium.io/pools/info/list?poolType=concentrated&poolSortField=volume24h&sortType=desc&pageSize=100&page=1", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    for (const pool of data.data?.data || []) {
      if (pool.day?.volume && pool.feeRate) {
        raydiumMap.set(pool.id, {
          volume24h: pool.day.volume,
          feeRate: pool.feeRate,
          feeAprDay: pool.day?.feeApr || pool.day?.apr || 0, // percentage number like 22.39
          tvl: pool.tvl || 0,
        });
      }
    }
  } catch {}

  cachedOrcaPools = orcaMap;
  cachedRaydiumPools = raydiumMap;
  poolStatsCacheTime = Date.now();
  return { orca: orcaMap, raydium: raydiumMap };
}

// Position-specific yield calculation:
// 
// Pool-wide daily yield = feeApr / 365 (this is what a full-range LP earns)
// Concentrated positions earn more because they provide liquidity in a narrower range.
// The concentration factor ≈ full_tick_range / position_tick_range
// But the actual pool has non-uniform liquidity distribution, so we use:
//   concentration = (posLiquidity / poolActiveLiquidity) × (poolTVL / positionValue)
//
// However, the API's feeApr is already for the CURRENT active liquidity (not full range),
// so we should NOT multiply by concentration again. Instead:
//   position_daily_yield = pool_daily_fees × (posLiq / poolActiveLiq) / posValue
//   where pool_daily_fees = volume × feeRate (raw, not APR-derived)
function calcPositionYield(
  stats: PoolStats,
  positionLiquidity: BN,
  poolActiveLiquidity: BN,
  positionValueUsd: number,
  dex: "orca" | "raydium",
): string {
  if (positionValueUsd <= 0 || poolActiveLiquidity.isZero()) return "-";

  // Derive daily LP fees from the API data
  // Orca: use feeApr (accounts for protocol fees, most accurate)
  // Raydium: use volume × feeRate × (1 - protocolFee) for consistency with their position view
  let poolDailyFees: number;
  if (dex === "orca") {
    // feeAprDay is decimal (0.593 = 59.3% annual)
    poolDailyFees = (stats.feeAprDay * stats.tvl) / 365;
  } else {
    // Raydium: volume × feeRate, then subtract ~25% for protocol fees
    // This aligns closer to what Raydium's position view shows
    poolDailyFees = stats.volume24h * stats.feeRate * 0.75;
  }
  if (poolDailyFees <= 0) return "-";

  // Position's share: only earns fees when price is in its range
  // When in range, share = posLiquidity / poolActiveLiquidity
  const posLiqNum = Number(positionLiquidity.toString());
  const poolLiqNum = Number(poolActiveLiquidity.toString());
  if (poolLiqNum === 0) return "-";

  let positionDailyYieldPct: number;
  if (dex === "raydium") {
    // Raydium: use pool-wide APR directly (their position UI shows close to pool-wide)
    // feeAprDay is percentage like 22.39
    positionDailyYieldPct = stats.feeAprDay / 365;
  } else {
    // Orca: use position-specific calculation with liquidity ratio
    const positionDailyFees = poolDailyFees * (posLiqNum / poolLiqNum);
    positionDailyYieldPct = (positionDailyFees / positionValueUsd) * 100;
  }

  return positionDailyYieldPct > 0 ? `${positionDailyYieldPct.toFixed(3)}%` : "-";
}

function sym(mint: string): string { return KNOWN_MINTS[mint]?.symbol || mint.slice(0, 4) + ".."; }
function dec(mint: string): number { return KNOWN_MINTS[mint]?.decimals || 6; }
function toUsd(mint: string, amount: number, solPrice: number): number {
  if (STABLES.has(mint)) return amount;
  if (mint === "So11111111111111111111111111111111111111112") return amount * solPrice;
  return 0;
}
function fmtUsd(n: number): string { return `$${n.toFixed(2)}`; }

// ============================================================
// BATCHED: Get all NFT mints from wallet in ONE RPC call
// Then batch-derive and batch-fetch Orca + Raydium position PDAs
// ============================================================
async function fetchAllPositions(wallet: PublicKey, solPrice: number): Promise<Position[]> {
  // 1. Single RPC call: get ALL token accounts
  const tokenAccounts = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });

  // 2. Filter to NFTs (amount === 1) and collect mints
  const nftMints: PublicKey[] = [];
  for (const { account } of tokenAccounts.value) {
    const parsed = AccountLayout.decode(account.data);
    if (Number(parsed.amount) === 1) {
      nftMints.push(new PublicKey(parsed.mint));
    }
  }

  if (nftMints.length === 0) return [];

  // 3. Derive ALL position PDAs at once (no RPC needed - pure math)
  const orcaPdas = nftMints.map(mint => ({
    mint,
    pda: PDAUtil.getPosition(ORCA_WHIRLPOOL_PROGRAM_ID, mint).publicKey,
  }));
  const raydiumPdas = nftMints.map(mint => ({
    mint,
    pda: PublicKey.findProgramAddressSync(
      [Buffer.from("position"), mint.toBuffer()],
      RAYDIUM_CLMM,
    )[0],
  }));

  // 4. Batch fetch ALL position accounts in chunks of 100 (RPC limit)
  const allPdaKeys = [
    ...orcaPdas.map(p => p.pda),
    ...raydiumPdas.map(p => p.pda),
  ];

  const batchSize = 100;
  const allAccountInfos: (any | null)[] = [];
  for (let i = 0; i < allPdaKeys.length; i += batchSize) {
    const chunk = allPdaKeys.slice(i, i + batchSize);
    const infos = await connection.getMultipleAccountsInfo(chunk);
    allAccountInfos.push(...infos);
  }

  const orcaAccountInfos = allAccountInfos.slice(0, orcaPdas.length);
  const raydiumAccountInfos = allAccountInfos.slice(orcaPdas.length);

  // 5. Identify which NFTs are Orca positions and which are Raydium
  const orcaPositionData: { mint: PublicKey; pda: PublicKey; data: Buffer }[] = [];
  const raydiumPositionData: { mint: PublicKey; pda: PublicKey; data: Buffer }[] = [];

  for (let i = 0; i < orcaPdas.length; i++) {
    const info = orcaAccountInfos[i];
    if (info && info.owner.equals(ORCA_WHIRLPOOL_PROGRAM_ID)) {
      orcaPositionData.push({ mint: orcaPdas[i].mint, pda: orcaPdas[i].pda, data: info.data });
    }
  }

  for (let i = 0; i < raydiumPdas.length; i++) {
    const info = raydiumAccountInfos[i];
    if (info && info.owner.equals(RAYDIUM_CLMM)) {
      raydiumPositionData.push({ mint: raydiumPdas[i].mint, pda: raydiumPdas[i].pda, data: info.data });
    }
  }

  // 6. Parse positions and batch-fetch pool data
  const positions: Position[] = [];
  const poolStats = await fetchPoolStats();

  // --- ORCA ---
  if (orcaPositionData.length > 0) {
    // Parse Orca position accounts to extract whirlpool pubkeys
    // Orca position layout (Anchor): discriminator(8) + whirlpool(32) + positionMint(32) + liquidity(16) + tickLowerIndex(4) + tickUpperIndex(4) + ...
    const orcaParsed = orcaPositionData.map(({ mint, pda, data }) => {
      let off = 8; // skip discriminator
      const whirlpool = new PublicKey(data.subarray(off, off + 32)); off += 32;
      off += 32; // positionMint
      const liquidity = new BN(data.subarray(off, off + 16), "le"); off += 16;
      const tickLowerIndex = data.readInt32LE(off); off += 4;
      const tickUpperIndex = data.readInt32LE(off);
      return { mint, pda, whirlpool, liquidity, tickLowerIndex, tickUpperIndex };
    });

    // Batch fetch all whirlpool accounts
    const uniquePools = [...new Set(orcaParsed.map(p => p.whirlpool.toBase58()))];
    const poolKeys = uniquePools.map(k => new PublicKey(k));
    const poolInfos = await connection.getMultipleAccountsInfo(poolKeys);
    const poolMap = new Map<string, Buffer>();
    poolKeys.forEach((k, i) => { if (poolInfos[i]) poolMap.set(k.toBase58(), poolInfos[i]!.data as Buffer); });

    for (const pos of orcaParsed) {
      try {
        const poolData = poolMap.get(pos.whirlpool.toBase58());
        if (!poolData || pos.liquidity.isZero()) continue;

        // Parse Whirlpool account: disc(8) + whirlpoolsConfig(32) + whirlpoolBump(1 + 1) + tickSpacing(2) + tickSpacingSeed(2) + feeRate(2) + protocolFeeRate(2) + liquidity(16) + sqrtPrice(16) + tickCurrentIndex(4) + ...+ tokenMintA(32) + tokenVaultA(32) + feeGrowthGlobalA(16) + tokenMintB(32)...
        // Simpler: use known offsets for the Whirlpool account
        // whirlpoolsConfig: 8, whirlpoolBump: 40, tickSpacing: 42, tickSpacingSeed: 44, feeRate: 46, protocolFeeRate: 48, liquidity: 50, sqrtPrice: 66, tickCurrentIndex: 82
        // then feeGrowthGlobalA: 86, feeGrowthGlobalB: 102, rewardLastUpdatedTimestamp: 118
        // tokenMintA: 126, tokenVaultA: 158, feeGrowthGlobalA... hmm this is getting complex
        // Let me use the SDK's anchor layout instead by using the fetcher
        
        // Actually, let me just use the Orca fetcher for pool data since we have the whirlpool keys
        // But that would be sequential. Instead, let me parse the binary data directly.
        // Whirlpool account (from IDL):
        // whirlpoolsConfig: Pubkey (8+0 = off 8), whirlpoolBump: [u8] (off 40), 
        // Actually the layout is: disc(8) + whirlpoolsConfig(32) + whirlpoolBump(2 bytes for bump array) + tickSpacing(2) + tickSpacingSeed(2 bytes) + feeRate(2) + protocolFeeRate(2) + liquidity(16) + sqrtPrice(16) + tickCurrentIndex(4) + protocolFeeOwedA(8) + protocolFeeOwedB(8) + tokenMintA(32) + tokenVaultA(32) + feeGrowthGlobalA(16) + tokenMintB(32) + tokenVaultB(32) + feeGrowthGlobalB(16) + rewardLastUpdatedTimestamp(8) + rewardInfos(3 * 128)
        
        // Key offsets (verified against live SOL/USDC whirlpool):
        const poolActiveLiquidity = new BN(poolData.subarray(49, 65), "le");
        const sqrtPrice = new BN(poolData.subarray(65, 81), "le");
        const tickCurrent = poolData.readInt32LE(81);
        const mintA = new PublicKey(poolData.subarray(101, 133));
        const mintB = new PublicKey(poolData.subarray(181, 213));

        const mintAStr = mintA.toBase58();
        const mintBStr = mintB.toBase58();
        const decA = dec(mintAStr);
        const decB = dec(mintBStr);

        const inRange = tickCurrent >= pos.tickLowerIndex && tickCurrent < pos.tickUpperIndex;

        const amounts = PoolUtil.getTokenAmountsFromLiquidity(
          pos.liquidity,
          sqrtPrice,
          PriceMath.tickIndexToSqrtPriceX64(pos.tickLowerIndex),
          PriceMath.tickIndexToSqrtPriceX64(pos.tickUpperIndex),
          true
        );

        const amountA = Number(amounts.tokenA) / Math.pow(10, decA);
        const amountB = Number(amounts.tokenB) / Math.pow(10, decB);
        const totalValue = toUsd(mintAStr, amountA, solPrice) + toUsd(mintBStr, amountB, solPrice);

        const lowerPrice = PriceMath.tickIndexToPrice(pos.tickLowerIndex, decA, decB);
        const upperPrice = PriceMath.tickIndexToPrice(pos.tickUpperIndex, decA, decB);

        // Position-specific yield using pool volume data from Orca API
        const orcaStats = poolStats.orca.get(pos.whirlpool.toBase58());
        const apy = orcaStats
          ? calcPositionYield(orcaStats, pos.liquidity, poolActiveLiquidity, totalValue, "orca")
          : "-";

        positions.push({
          id: pos.pda.toBase58(),
          positionMint: pos.mint.toBase58(),
          positionAddress: pos.pda.toBase58(),
          poolAddress: pos.whirlpool.toBase58(),
          pair: `${sym(mintAStr)}/${sym(mintBStr)}`,
          dex: "Orca",
          deposited: fmtUsd(totalValue),
          current: fmtUsd(totalValue),
          pnl: "$0.00",
          pnlPct: "0.0%",
          apy,
          range: `${lowerPrice.toFixed(2)} - ${upperPrice.toFixed(2)}`,
          status: inRange ? "in-range" : "out-of-range",
          rebalances: 0,
          age: "",
          feesEarned: "$0.00",
          nextRebalance: "Monitoring",
          autoRebalance: false, // set after rebalance config fetch
        });
      } catch { continue; }
    }
  }

  // --- RAYDIUM ---
  if (raydiumPositionData.length > 0) {
    const raydiumParsed = raydiumPositionData.map(({ mint, pda, data }) => {
      let off = 8 + 1; // disc + bump
      off += 32; // nftMint
      const poolId = new PublicKey(data.subarray(off, off + 32)); off += 32;
      const tickLower = data.readInt32LE(off); off += 4;
      const tickUpper = data.readInt32LE(off); off += 4;
      const liquidity = new BN(data.subarray(off, off + 16), "le");
      return { mint, pda, poolId, tickLower, tickUpper, liquidity };
    });

    // Batch fetch pool accounts
    const uniquePools = [...new Set(raydiumParsed.map(p => p.poolId.toBase58()))];
    const poolKeys = uniquePools.map(k => new PublicKey(k));
    const poolInfos = await connection.getMultipleAccountsInfo(poolKeys);
    const poolMap = new Map<string, Buffer>();
    poolKeys.forEach((k, i) => { if (poolInfos[i]) poolMap.set(k.toBase58(), poolInfos[i]!.data as Buffer); });

    for (const pos of raydiumParsed) {
      try {
        const poolData = poolMap.get(pos.poolId.toBase58());
        if (!poolData || pos.liquidity.isZero()) continue;

        // Raydium CLMM pool layout: disc(8) + bump(1) + ammConfig(32) + creator(32) + mintA(32) + mintB(32) + tokenVaultA(32) + tokenVaultB(32) + observationKey(32) + mintDecimalsA(1) + mintDecimalsB(1) + tickSpacing(2) + liquidity(16) + sqrtPriceX64(16) + tickCurrent(4)
        let pOff = 8 + 1 + 32 + 32; // = 73
        const mintA = new PublicKey(poolData.subarray(pOff, pOff + 32)); pOff += 32;
        const mintB = new PublicKey(poolData.subarray(pOff, pOff + 32)); pOff += 32;
        pOff += 32 + 32 + 32; // vaultA + vaultB + observationKey
        const decA = poolData[pOff]; pOff += 1;
        const decB = poolData[pOff]; pOff += 1;
        pOff += 2; // tickSpacing
        const raydiumPoolLiquidity = new BN(poolData.subarray(pOff, pOff + 16), "le"); pOff += 16;
        const sqrtPriceX64 = new BN(poolData.subarray(pOff, pOff + 16), "le"); pOff += 16;
        const tickCurrent = poolData.readInt32LE(pOff);

        const mintAStr = mintA.toBase58();
        const mintBStr = mintB.toBase58();
        const inRange = tickCurrent >= pos.tickLower && tickCurrent < pos.tickUpper;

        const amounts = PoolUtil.getTokenAmountsFromLiquidity(
          pos.liquidity,
          sqrtPriceX64,
          PriceMath.tickIndexToSqrtPriceX64(pos.tickLower),
          PriceMath.tickIndexToSqrtPriceX64(pos.tickUpper),
          true
        );

        const amountA = Number(amounts.tokenA) / Math.pow(10, decA);
        const amountB = Number(amounts.tokenB) / Math.pow(10, decB);
        const totalValue = toUsd(mintAStr, amountA, solPrice) + toUsd(mintBStr, amountB, solPrice);

        const lowerPrice = PriceMath.tickIndexToPrice(pos.tickLower, decA, decB);
        const upperPrice = PriceMath.tickIndexToPrice(pos.tickUpper, decA, decB);

        // Position-specific yield
        const rayStats = poolStats.raydium.get(pos.poolId.toBase58());
        const apy = rayStats
          ? calcPositionYield(rayStats, pos.liquidity, raydiumPoolLiquidity, totalValue, "raydium")
          : "-";

        positions.push({
          id: pos.pda.toBase58(),
          positionMint: pos.mint.toBase58(),
          positionAddress: pos.pda.toBase58(),
          poolAddress: pos.poolId.toBase58(),
          pair: `${sym(mintAStr)}/${sym(mintBStr)}`,
          dex: "Raydium",
          deposited: fmtUsd(totalValue),
          current: fmtUsd(totalValue),
          pnl: "$0.00",
          pnlPct: "0.0%",
          apy,
          range: `${lowerPrice.toFixed(2)} - ${upperPrice.toFixed(2)}`,
          status: inRange ? "in-range" : "out-of-range",
          rebalances: 0,
          age: "",
          feesEarned: "$0.00",
          nextRebalance: "Monitoring",
          autoRebalance: false, // set after rebalance config fetch
        });
      } catch { continue; }
    }
  }

  // --- METEORA DLMM ---
  // Use @meteora-ag/dlmm SDK for accurate position values
  try {
    const meteoraAccounts = await connection.getProgramAccounts(METEORA_DLMM, {
      filters: [
        { memcmp: { offset: 40, bytes: wallet.toBase58() } },
      ],
    });

    if (meteoraAccounts.length > 0) {
      // Group positions by LB pair
      const pairPositions = new Map<string, PublicKey[]>();
      const positionLbPair = new Map<string, string>();

      for (const { pubkey, account } of meteoraAccounts) {
        const data = account.data as Buffer;
        if (data.length < 80) continue;
        const lbPair = new PublicKey(data.subarray(8, 40));
        const owner = new PublicKey(data.subarray(40, 72));
        if (!owner.equals(wallet)) continue;
        const pairKey = lbPair.toBase58();
        positionLbPair.set(pubkey.toBase58(), pairKey);
        if (!pairPositions.has(pairKey)) pairPositions.set(pairKey, []);
        pairPositions.get(pairKey)!.push(pubkey);
      }

      // Batch fetch LB pair accounts for mint info
      const lbPairKeys = [...pairPositions.keys()].map(k => new PublicKey(k));
      const pairInfos = lbPairKeys.length > 0
        ? await connection.getMultipleAccountsInfo(lbPairKeys)
        : [];
      const pairDataMap = new Map<string, Buffer>();
      lbPairKeys.forEach((k, i) => { if (pairInfos[i]) pairDataMap.set(k.toBase58(), pairInfos[i]!.data as Buffer); });

      // Fetch Meteora API data for each pair (APR, TVL, price)
      const meteoraApiData = new Map<string, { tvl: number; apr: number; currentPrice: number }>();
      await Promise.all(lbPairKeys.map(async (key) => {
        try {
          const res = await fetch(`https://dlmm-api.meteora.ag/pair/${key.toBase58()}`, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const d = await res.json();
            meteoraApiData.set(key.toBase58(), {
              tvl: Number(d.liquidity) || 0,
              apr: Number(d.apr) || 0,
              currentPrice: Number(d.current_price) || 0,
            });
          }
        } catch {}
      }));

      // Use DLMM SDK to get accurate position values
      const { default: DLMM } = await import("@meteora-ag/dlmm");

      for (const [pairKey, posPubkeys] of pairPositions) {
        try {
          const pairData = pairDataMap.get(pairKey);
          if (!pairData) continue;

          const mintX = new PublicKey(pairData.subarray(88, 120));
          const mintY = new PublicKey(pairData.subarray(120, 152));
          const mintXStr = mintX.toBase58();
          const mintYStr = mintY.toBase58();
          if (!KNOWN_MINTS[mintXStr] && !KNOWN_MINTS[mintYStr]) continue;

          const decX = dec(mintXStr);
          const decY = dec(mintYStr);
          const apiData = meteoraApiData.get(pairKey);
          const pairApr = apiData?.apr || 0;

          // Create DLMM instance and get positions
          const dlmmPool = await DLMM.create(connection, new PublicKey(pairKey));
          const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(wallet);

          for (const userPos of userPositions) {
            const posData = userPos.positionData;
            // totalXAmount and totalYAmount are BN values in raw token units
            const amountX = Number(posData.totalXAmount.toString()) / Math.pow(10, decX);
            const amountY = Number(posData.totalYAmount.toString()) / Math.pow(10, decY);
            const totalValue = toUsd(mintXStr, amountX, solPrice) + toUsd(mintYStr, amountY, solPrice);

            // Fees earned
            const feeX = Number(posData.feeX.toString()) / Math.pow(10, decX);
            const feeY = Number(posData.feeY.toString()) / Math.pow(10, decY);
            const feesUsd = toUsd(mintXStr, feeX, solPrice) + toUsd(mintYStr, feeY, solPrice);

            const inRange = dlmmPool.lbPair.activeId >= posData.lowerBinId && dlmmPool.lbPair.activeId <= posData.upperBinId;
            const apy = pairApr > 0 ? `${(pairApr / 365).toFixed(3)}%` : "-";

            positions.push({
              id: userPos.publicKey.toBase58(),
              positionAddress: userPos.publicKey.toBase58(),
              poolAddress: pairKey,
              pair: `${sym(mintXStr)}/${sym(mintYStr)}`,
              dex: "Meteora",
              deposited: fmtUsd(totalValue),
              current: fmtUsd(totalValue),
              pnl: feesUsd > 0 ? `+${fmtUsd(feesUsd)}` : "$0.00",
              pnlPct: totalValue > 0 && feesUsd > 0 ? `+${((feesUsd / totalValue) * 100).toFixed(1)}%` : "0.0%",
              apy,
              range: `Bins ${posData.lowerBinId}-${posData.upperBinId}`,
              status: inRange ? "in-range" : "out-of-range",
              rebalances: 0,
              age: "",
              feesEarned: fmtUsd(feesUsd),
              nextRebalance: "Monitoring",
              autoRebalance: false,
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch Meteora positions for pair ${pairKey}:`, err);
          // Fallback: show basic position without values
          const pairData = pairDataMap.get(pairKey);
          if (!pairData) continue;
          const mintX = new PublicKey(pairData.subarray(88, 120));
          const mintY = new PublicKey(pairData.subarray(120, 152));
          for (const pubkey of posPubkeys) {
            positions.push({
              id: pubkey.toBase58(),
              positionAddress: pubkey.toBase58(),
              poolAddress: pairKey,
              pair: `${sym(mintX.toBase58())}/${sym(mintY.toBase58())}`,
              dex: "Meteora",
              deposited: "-",
              current: "-",
              pnl: "$0.00",
              pnlPct: "0.0%",
              apy: "-",
              range: "Active",
              status: "in-range",
              rebalances: 0,
              age: "",
              feesEarned: "$0.00",
              nextRebalance: "Monitoring",
              autoRebalance: false,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("Failed to fetch Meteora positions:", err);
  }

  // Fetch wallet-level rebalance config from on-chain
  const rebalanceEnabled = await fetchRebalanceEnabled(wallet);
  for (const pos of positions) {
    pos.autoRebalance = rebalanceEnabled;
  }

  return positions;
}

// ============================================================
// Main hook
// ============================================================
export function usePositions() {
  const { publicKey, connected } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetchedOnce = useRef(false);

  const fetchPositions = useCallback(async () => {
    if (!publicKey || !connected) return;

    if (!hasFetchedOnce.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const solPrice = await fetchSolPrice();
      const all = await fetchAllPositions(publicKey, solPrice);
      setPositions(all);
      hasFetchedOnce.current = true;
    } catch (err) {
      console.warn("Failed to fetch positions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicKey, connected]);

  useEffect(() => {
    if (connected && publicKey) {
      hasFetchedOnce.current = false;
      fetchPositions();
    } else {
      setPositions([]);
      hasFetchedOnce.current = false;
    }
  }, [connected, publicKey, fetchPositions]);

  return { positions, loading, refreshing, refetch: fetchPositions };
}
