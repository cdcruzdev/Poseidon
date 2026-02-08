# Meteora Pool Types Research

## Pool Types Overview

Meteora offers 3 main pool types:

### 1. DLMM (Dynamic Liquidity Market Maker) ✅ Integrated
- **API:** `https://dlmm-api.meteora.ag`
- **Concentrated liquidity:** Yes — uses discrete price bins
- **Key features:** Dynamic fees, precise liquidity concentration, bin-based pricing
- **SDK:** `@meteora-ag/dlmm`
- **Status:** Fully integrated in our adapter

### 2. DAMM v2 (Dynamic Automated Market Maker v2) ⚠️ Not Yet Integrated
- **API:** `https://amm-v2.meteora.ag` (pool-address-based queries only, no list-all endpoint)
- **Program ID:** `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`
- **Concentrated liquidity:** **Optional** — it's a constant-product AMM (x*y=k) with optional sqrtMinPrice/sqrtMaxPrice bounds
- **Key features:** Position NFTs, dynamic fee schedules (anti-sniper), fee market cap scheduler
- **SDK:** `@meteora-ag/cp-amm-sdk`
- **Pool discovery:** No `/pair/all` API endpoint. Must use SDK's `getAllPools()` or `fetchPoolStatesByTokenAMint()` (on-chain RPC calls)
- **Status:** Not integrated. Could be added but:
  - Pool discovery requires on-chain queries (expensive/slow compared to API)
  - Most DAMM v2 pools are for token launches (not typical trading pairs)
  - Concentrated liquidity is optional — many pools use full-range

### 3. DAMM v1 (Dynamic AMM / Legacy)
- **API:** Unknown (likely `https://app.meteora.ag` internal)
- **SDK:** `@meteora-ag/dynamic-amm-sdk`
- **Concentrated liquidity:** No — pure constant-product with dynamic vault integration
- **Status:** Not relevant for our use case (no concentrated liquidity)

## Decision: Why Not Integrate DAMM v2 Now

1. **No pool listing API** — `amm-v2.meteora.ag` only serves individual pool data by address. Pool discovery requires on-chain `getProgramAccounts` calls which are slow and rate-limited.
2. **Most DAMM v2 pools are launch pools** — They're used for token launches with fee schedules, not for ongoing LP strategies.
3. **DLMM is Meteora's primary CL product** — DLMM has superior concentrated liquidity with discrete bins vs DAMM v2's optional sqrt price ranges.
4. **Hackathon scope** — Adding on-chain pool discovery adds complexity without much user value for the demo.

## Future Integration Path

If DAMM v2 integration is desired later:
1. Install `@meteora-ag/cp-amm-sdk`
2. Use `CpAmm.fetchPoolStatesByTokenAMint()` for pool discovery
3. Filter for pools with concentrated ranges (sqrtMinPrice != 0)
4. The `poolType: 'DAMM_V2'` field is already defined in our types

## Multi-Provider Verification

All 3 DEX adapters (Meteora DLMM, Orca Whirlpools, Raydium CLMM) are:
- ✅ Registered in `createDefaultRegistry()` (`src/dex/index.ts`)
- ✅ Queried in parallel by the aggregator (`src/core/aggregator.ts`)
- ✅ Returned in `/api/compare` and `/api/best-pool` endpoints
- ✅ Each pool now includes a `poolType` field (DLMM, Whirlpool, CLMM)
