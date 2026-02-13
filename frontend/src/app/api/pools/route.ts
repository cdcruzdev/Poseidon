import { NextRequest, NextResponse } from "next/server";

const HELIUS_RPC = process.env.HELIUS_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=a9d759b5-f465-44ec-b753-92ab3007b641";

// Token mint addresses
const MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  RNDR: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  JITO: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
};

function getMint(symbol: string): string | undefined {
  return MINTS[symbol.toUpperCase()];
}

async function fetchOrcaPools(mintA: string, mintB: string): Promise<any[]> {
  try {
    const res = await fetch("https://api.mainnet.orca.so/v1/whirlpool/list", {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pools = (data.whirlpools || []).filter((p: any) => {
      const mints = [p.tokenA?.mint, p.tokenB?.mint];
      return mints.includes(mintA) && mints.includes(mintB);
    });
    return pools.map((p: any) => ({
      address: p.address,
      dex: "orca" as const,
      tokenA: p.tokenA?.symbol || "?",
      tokenB: p.tokenB?.symbol || "?",
      tokenAMint: p.tokenA?.mint,
      tokenBMint: p.tokenB?.mint,
      tokenAPrice: p.tokenA?.usdPrice || 0,
      tokenBPrice: p.tokenB?.usdPrice || 0,
      feeTier: p.lpFeeRate ? p.lpFeeRate * 100 : (p.tickSpacing === 1 ? 0.01 : p.tickSpacing === 4 ? 0.04 : p.tickSpacing === 8 ? 0.05 : p.tickSpacing === 64 ? 0.3 : p.tickSpacing === 128 ? 1 : 0.3),
      tvl: p.tvl || 0,
      volume24h: p.volume?.day || 0,
      apr24h: p.reward_apr?.day ? p.reward_apr.day * 100 : undefined,
      yield24h: p.feeApr?.day ? p.feeApr.day * 100 / 365 : undefined,
      estimatedApr: p.feeApr?.day ? p.feeApr.day * 100 : 0,
      price: p.price || 0,
      tickSpacing: p.tickSpacing,
    }));
  } catch {
    return [];
  }
}

async function fetchRaydiumPools(mintA: string, mintB: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api-v3.raydium.io/pools/info/mint?mint1=${mintA}&mint2=${mintB}&poolType=concentrated&poolSortField=default&sortType=desc&pageSize=20&page=1`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const pools = data.data?.data || [];
    return pools.map((p: any) => ({
      address: p.id,
      dex: "raydium" as const,
      tokenA: p.mintA?.symbol || "?",
      tokenB: p.mintB?.symbol || "?",
      tokenAMint: p.mintA?.address,
      tokenBMint: p.mintB?.address,
      tokenAPrice: p.mintA?.usdPrice || p.mintAmountCoin * (p.tvl || 0) / 2 || 0,
      tokenBPrice: p.mintB?.usdPrice || 0,
      feeTier: p.feeRate ? p.feeRate * 100 : 0.25,
      tvl: p.tvl || 0,
      volume24h: p.day?.volume || 0,
      apr24h: p.day?.apr || undefined,
      yield24h: p.day?.apr ? p.day.apr / 365 : undefined,
      estimatedApr: p.day?.apr || 0,
      price: p.price || 0,
    }));
  } catch {
    return [];
  }
}

async function fetchMeteoraPools(mintA: string, mintB: string): Promise<any[]> {
  try {
    // Use grouped search endpoint (pair/all is 149MB+ and times out)
    const res = await fetch(
      `https://dlmm-api.meteora.ag/pair/all_by_groups?page=0&limit=50&sort_key=tvl&order_by=desc&search_term=${mintA}&include_unknown=false`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    
    // Extract matching pairs from groups
    const allPairs: any[] = [];
    for (const group of (data.groups || [])) {
      for (const p of (group.pairs || [])) {
        const mints = [p.mint_x, p.mint_y];
        if (mints.includes(mintA) && mints.includes(mintB)) {
          allPairs.push(p);
        }
      }
    }

    return allPairs.map((p: any) => ({
      address: p.address,
      dex: "meteora" as const,
      tokenA: p.name?.split("-")[0]?.trim() || "?",
      tokenB: p.name?.split("-")[1]?.trim() || "?",
      tokenAMint: p.mint_x,
      tokenBMint: p.mint_y,
      tokenAPrice: 0,
      tokenBPrice: 0,
      feeTier: p.base_fee_percentage ? parseFloat(p.base_fee_percentage) : 0.25,
      tvl: p.liquidity || 0,
      volume24h: p.trade_volume_24h || 0,
      apr24h: p.apr ? parseFloat(p.apr) : undefined,
      yield24h: p.apr ? parseFloat(p.apr) / 365 : undefined,
      estimatedApr: p.apr ? parseFloat(p.apr) : 0,
      price: p.current_price || 0,
      binStep: p.bin_step,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenA = searchParams.get("tokenA") || "";
  const tokenB = searchParams.get("tokenB") || "";
  const dex = searchParams.get("dex") || "";

  const mintA = getMint(tokenA);
  const mintB = getMint(tokenB);

  if (!mintA || !mintB) {
    return NextResponse.json({ success: false, error: "Unknown token" }, { status: 400 });
  }

  let pools: any[] = [];
  if (!dex || dex === "orca") {
    const orca = await fetchOrcaPools(mintA, mintB);
    pools.push(...orca);
  }
  if (!dex || dex === "raydium") {
    const ray = await fetchRaydiumPools(mintA, mintB);
    pools.push(...ray);
  }
  if (!dex || dex === "meteora") {
    const met = await fetchMeteoraPools(mintA, mintB);
    pools.push(...met);
  }

  return NextResponse.json({ success: true, data: pools });
}
