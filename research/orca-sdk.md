# Orca Whirlpools SDK - Comprehensive Guide for LP Position Management

> **Last Updated:** February 2026  
> **Program Address:** `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`  
> **Networks:** Solana Mainnet, Solana Devnet, Eclipse Mainnet, Eclipse Testnet

---

## Table of Contents
1. [NPM Packages Needed](#1-npm-packages-needed)
2. [Creating a Position](#2-creating-a-position)
3. [Reading Position Data](#3-reading-position-data)
4. [Removing Liquidity](#4-removing-liquidity)
5. [Rebalancing](#5-rebalancing)
6. [Fee Tiers](#6-fee-tiers)
7. [Pool Discovery](#7-pool-discovery)
8. [Key Gotchas](#8-key-gotchas)

---

## 1. NPM Packages Needed

### Option A: New High-Level SDK (Solana Kit - Web3.js v2)
**Recommended for new projects. Uses Solana Web3.js v2.**

```bash
npm install @orca-so/whirlpools @solana/kit@2
```

**Package breakdown:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@orca-so/whirlpools` | `^6.0.0` | High-level SDK (positions, pools, swaps) |
| `@solana/kit` | `^2.x` | Solana Web3.js v2 utilities |

### Option B: Legacy SDK (Solana Web3.js v1)
**Use this if your project already uses Web3.js v1 or Anchor.**

```bash
npm install @orca-so/whirlpools-sdk @orca-so/common-sdk @coral-xyz/anchor@0.31.1 @solana/web3.js @solana/spl-token decimal.js
```

**Package breakdown:**
| Package | Version | Purpose |
|---------|---------|---------|
| `@orca-so/whirlpools-sdk` | `^0.13.x` | Legacy high-level SDK |
| `@orca-so/common-sdk` | `latest` | Common utilities |
| `@coral-xyz/anchor` | `0.31.1` | Anchor framework |
| `@solana/web3.js` | `^1.x` | Solana Web3.js v1 |
| `@solana/spl-token` | `latest` | SPL Token utilities |
| `decimal.js` | `latest` | Decimal math |

### Additional Low-Level Packages (if needed)
```bash
# Low-level client for direct instruction building
npm install @orca-so/whirlpools-client

# Core math/quote utilities (compiled from Rust to WASM)
npm install @orca-so/whirlpools-core
```

---

## 2. Creating a Position

### 2.1 Configuration Setup

```typescript
import { 
  setWhirlpoolsConfig, 
  setPayerFromBytes, 
  setRpc,
  setPriorityFeeSetting,
  setJitoTipSetting
} from "@orca-so/whirlpools";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import fs from "fs";

// Load wallet
const keyPairBytes = new Uint8Array(
  JSON.parse(fs.readFileSync("path/to/keypair.json", "utf8"))
);
const wallet = await createKeyPairSignerFromBytes(keyPairBytes);

// Configure SDK for network
await setWhirlpoolsConfig("solanaMainnet"); // or "solanaDevnet", "eclipseMainnet", "eclipseTestnet"

// Set payer and RPC
await setPayerFromBytes(keyPairBytes);
await setRpc("https://api.mainnet-beta.solana.com");

// Optional: Configure priority fees
setPriorityFeeSetting({
  type: "dynamic",
  maxCapLamports: BigInt(4_000_000), // 0.004 SOL
});

// Optional: Configure Jito tips
setJitoTipSetting({
  type: "dynamic", 
  maxCapLamports: BigInt(4_000_000),
});
```

### 2.2 Opening a Full-Range Position (Splash Pool)

Full-range positions provide liquidity across all price levels. Simpler but less capital efficient.

```typescript
import { openFullRangePosition } from "@orca-so/whirlpools";
import { address } from "@solana/kit";

const { positionAddress, callback } = await openFullRangePosition(
  address("POOL_ADDRESS"), // Whirlpool address
  {
    tokenA: BigInt(1_000_000), // Amount of token A (in native units/lamports)
    // OR tokenB: BigInt(...), OR liquidity: BigInt(...)
  },
  50 // Slippage tolerance in basis points (0.5%)
);

// Execute the transaction
const signature = await callback();
console.log(`Position created at ${positionAddress} in tx ${signature}`);
```

### 2.3 Opening a Concentrated Liquidity Position

Concentrated positions provide liquidity within a specific price range. More capital efficient.

```typescript
import { openConcentratedPosition } from "@orca-so/whirlpools";
import { address } from "@solana/kit";

const { positionAddress, callback, quote } = await openConcentratedPosition(
  address("POOL_ADDRESS"), // Whirlpool address
  {
    tokenA: BigInt(1_000_000), // Amount of token A to add
    // OR tokenB: BigInt(...), OR liquidity: BigInt(...)
  },
  19.5, // Lower price bound
  20.5, // Upper price bound
  50    // Slippage tolerance in basis points
);

// Check the quote before executing
console.log(`Token A max: ${quote.tokenMaxA}`);
console.log(`Token B max: ${quote.tokenMaxB}`);

// Execute the transaction
const signature = await callback();
console.log(`Concentrated position at ${positionAddress} in tx ${signature}`);
```

### 2.4 Legacy SDK: Opening a Position

```typescript
import { WhirlpoolContext, buildWhirlpoolClient, PDAUtil, TickUtil } from "@orca-so/whirlpools-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";

// Setup context
const provider = AnchorProvider.env();
const ctx = WhirlpoolContext.from(provider.connection, provider.wallet, WHIRLPOOL_PROGRAM_ID);
const client = buildWhirlpoolClient(ctx);

// Get pool
const poolAddress = PDAUtil.getWhirlpool(
  WHIRLPOOL_PROGRAM_ID,
  ORCA_WHIRLPOOLS_CONFIG,
  SOL_MINT,
  USDC_MINT,
  64 // tick spacing
);
const pool = await client.getPool(poolAddress.publicKey);
const poolData = pool.getData();

// Calculate tick indices from prices
const tokenADecimal = pool.getTokenAInfo().decimals;
const tokenBDecimal = pool.getTokenBInfo().decimals;

const tickLower = TickUtil.getInitializableTickIndex(
  PriceMath.priceToTickIndex(new Decimal(19.5), tokenADecimal, tokenBDecimal),
  poolData.tickSpacing
);
const tickUpper = TickUtil.getInitializableTickIndex(
  PriceMath.priceToTickIndex(new Decimal(20.5), tokenADecimal, tokenBDecimal),
  poolData.tickSpacing
);

// Open position
const { positionMint, tx } = await pool.openPosition(
  tickLower,
  tickUpper,
  { tokenA: new BN(1_000_000) }, // IncreaseLiquidityInput
  wallet.publicKey,  // wallet
  wallet.publicKey   // funder
);

await tx.buildAndExecute();
```

---

## 3. Reading Position Data

### 3.1 Fetch All Positions for a Wallet

```typescript
import { fetchPositionsForOwner } from "@orca-so/whirlpools";
import { createSolanaRpc, devnet, address } from "@solana/kit";

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const ownerAddress = address("WALLET_ADDRESS");

const positions = await fetchPositionsForOwner(rpc, ownerAddress);

for (const position of positions) {
  if (position.isPositionBundle) {
    console.log("Position Bundle:", position);
  } else {
    const pos = position.data;
    console.log("Position Mint:", position.address);
    console.log("Whirlpool:", pos.whirlpool);
    console.log("Liquidity:", pos.liquidity);
    console.log("Tick Lower:", pos.tickLowerIndex);
    console.log("Tick Upper:", pos.tickUpperIndex);
    console.log("Fee Owed A:", pos.feeOwedA);
    console.log("Fee Owed B:", pos.feeOwedB);
    console.log("Reward Owed 0:", pos.rewardInfos[0].amountOwed);
    console.log("Reward Owed 1:", pos.rewardInfos[1].amountOwed);
    console.log("Reward Owed 2:", pos.rewardInfos[2].amountOwed);
  }
}
```

### 3.2 Check if Position is In Range

```typescript
import { isPositionInRange } from "@orca-so/whirlpools-core";

const currentSqrtPrice = 7448043534253661173n; // From pool data
const tickLower = -18304;
const tickUpper = -17956;

const inRange = isPositionInRange(currentSqrtPrice, tickLower, tickUpper);
console.log("Position in range:", inRange);
```

### 3.3 Get Fee and Reward Quotes (Before Collecting)

```typescript
import { harvestPosition } from "@orca-so/whirlpools";
import { address } from "@solana/kit";

const { feesQuote, rewardsQuote, callback } = await harvestPosition(
  address("POSITION_MINT_ADDRESS")
);

// Read quotes without executing
console.log("Fees owed A:", feesQuote.feeOwedA);
console.log("Fees owed B:", feesQuote.feeOwedB);
console.log("Reward 0 owed:", rewardsQuote.rewards[0].rewardsOwed);
console.log("Reward 1 owed:", rewardsQuote.rewards[1].rewardsOwed);
console.log("Reward 2 owed:", rewardsQuote.rewards[2].rewardsOwed);
```

### 3.4 Legacy SDK: Position Data

```typescript
import { PDAUtil, PositionUtil, collectFeesQuote, collectRewardsQuote } from "@orca-so/whirlpools-sdk";

// Get position
const positionPda = PDAUtil.getPosition(WHIRLPOOL_PROGRAM_ID, positionMintAddress);
const position = await client.getPosition(positionPda.publicKey);
const positionData = position.getData();

console.log("Liquidity:", positionData.liquidity.toString());
console.log("Lower tick:", positionData.tickLowerIndex);
console.log("Upper tick:", positionData.tickUpperIndex);

// Get fee quote
const pool = await client.getPool(positionData.whirlpool);
const feesQuote = collectFeesQuote({
  whirlpool: pool.getData(),
  position: positionData,
  tickLower: await client.fetcher.getTickArray(tickLowerArrayPda),
  tickUpper: await client.fetcher.getTickArray(tickUpperArrayPda),
});

console.log("Fee A owed:", feesQuote.feeOwedA.toString());
console.log("Fee B owed:", feesQuote.feeOwedB.toString());
```

---

## 4. Removing Liquidity

### 4.1 Decrease Liquidity (Partial Withdrawal)

```typescript
import { decreaseLiquidityInstructions } from "@orca-so/whirlpools";
import { address } from "@solana/kit";

const result = await decreaseLiquidityInstructions(
  rpc,
  address("POSITION_MINT_ADDRESS"),
  { tokenA: BigInt(500_000) }, // Amount to withdraw (or tokenB, or liquidity)
  100, // Slippage tolerance (1%)
  wallet.pubkey()
);

console.log("Quote - Token A to receive:", result.quote.tokenEstA);
console.log("Quote - Token B to receive:", result.quote.tokenEstB);

// Build and send transaction
const signers = [wallet, ...result.additionalSigners];
// ... send transaction with result.instructions
```

### 4.2 Close Position Entirely

Closing a position withdraws ALL liquidity, collects all fees/rewards, and burns the position NFT.

```typescript
import { closePositionInstructions } from "@orca-so/whirlpools";
import { address } from "@solana/kit";

const result = await closePositionInstructions(
  rpc,
  address("POSITION_MINT_ADDRESS"),
  100, // Slippage tolerance
  wallet.pubkey()
);

console.log("Token estimate B:", result.quote.tokenEstB);
console.log("Fees Quote:", result.feesQuote);
console.log("Rewards Quote:", result.rewardsQuote);

// Execute
const signers = [wallet, ...result.additionalSigners];
// ... send transaction with result.instructions
```

### 4.3 Harvest Fees/Rewards (Without Closing)

```typescript
import { harvestPosition, harvestAllPositionFees } from "@orca-so/whirlpools";
import { address } from "@solana/kit";

// Single position
const { callback, feesQuote, rewardsQuote } = await harvestPosition(
  address("POSITION_MINT_ADDRESS")
);

console.log("Fees to collect:", feesQuote.feeOwedA, feesQuote.feeOwedB);
console.log("Rewards to collect:", rewardsQuote.rewards[0].rewardsOwed);

const signature = await callback();
console.log(`Harvested in tx ${signature}`);

// All positions at once
const signatures = await harvestAllPositionFees();
console.log(`Harvested all positions in ${signatures.length} transactions`);
```

### 4.4 Legacy SDK: Close Position

```typescript
const txs = await pool.closePosition(
  positionAddress,
  Percentage.fromFraction(1, 100), // 1% slippage
  destinationWallet,
  positionWallet,
  payer
);

// Execute transactions serially (important!)
for (const tx of txs) {
  await tx.buildAndExecute();
}
```

---

## 5. Rebalancing

**Rebalancing requires closing the old position and opening a new one with a different price range.**

There is no direct "change range" instruction in the Whirlpools program.

### 5.1 Rebalancing Strategy

```typescript
import {
  closePositionInstructions,
  openConcentratedPosition
} from "@orca-so/whirlpools";
import { address } from "@solana/kit";

async function rebalancePosition(
  positionMint: string,
  poolAddress: string,
  newLowerPrice: number,
  newUpperPrice: number,
  slippageBps: number = 100
) {
  // Step 1: Close existing position (withdraws liquidity + collects fees)
  const closeResult = await closePositionInstructions(
    rpc,
    address(positionMint),
    slippageBps,
    wallet.pubkey()
  );
  
  // Execute close
  // ... send closeResult.instructions
  
  // Step 2: Open new position with different range
  const { positionAddress, callback, quote } = await openConcentratedPosition(
    address(poolAddress),
    {
      // Use the amounts received from closing
      tokenA: closeResult.quote.tokenEstA + closeResult.feesQuote.feeOwedA,
    },
    newLowerPrice,
    newUpperPrice,
    slippageBps
  );
  
  const signature = await callback();
  return { newPositionAddress: positionAddress, signature };
}
```

### 5.2 Increase Liquidity in Existing Position

```typescript
import { increasePosLiquidity } from "@orca-so/whirlpools";
import { address } from "@solana/kit";

const { callback, quote } = await increasePosLiquidity(
  address("POSITION_ADDRESS"),
  {
    tokenA: BigInt(1_000_000), // Additional amount to add
  },
  50 // Slippage tolerance
);

// Check quote before executing
if (quote.tokenMaxB < BigInt(1_000_000)) {
  const sig = await callback();
  console.log(`Added liquidity in tx ${sig}`);
}
```

---

## 6. Fee Tiers

### Solana Mainnet Fee Tiers

| Tick Spacing | Fee Tier | LP Receives | Protocol | Climate Fund | Use Case |
|-------------|----------|-------------|----------|--------------|----------|
| 1 | 0.01% | 0.0087% | 0.0012% | 0.0001% | Highly stable pairs |
| 2 | 0.02% | 0.0174% | 0.0024% | 0.0002% | Stable pairs |
| 4 | 0.04% | 0.0348% | 0.0048% | 0.0004% | Stable pairs |
| 8 | 0.08% | 0.0696% | 0.0096% | 0.0008% | Correlated pairs |
| 16 | 0.16% | 0.1392% | 0.0192% | 0.0016% | Low volatility |
| 64 | 0.3% | 0.261% | 0.036% | 0.003% | **Most common** |
| 96 | 0.65% | 0.5655% | 0.0078% | 0.0065% | Medium volatility |
| 128 | 1% | 0.87% | 0.12% | 0.01% | Volatile pairs |
| 256 | 2% | 1.74% | 0.24% | 0.02% | Highly volatile |

**Key mapping:**
```typescript
const TICK_SPACING_TO_FEE: Record<number, number> = {
  1: 0.0001,    // 0.01%
  2: 0.0002,    // 0.02%
  4: 0.0004,    // 0.04%
  8: 0.0008,    // 0.08%
  16: 0.0016,   // 0.16%
  64: 0.003,    // 0.3%
  96: 0.0065,   // 0.65%
  128: 0.01,    // 1%
  256: 0.02,    // 2%
};
```

### Adaptive Fee Pools
- Base fee is the selected tier, but actual fee can increase based on volatility
- LP split remains constant: 87% LP, 12% Protocol, 1% Climate Fund
- Higher fees during volatile periods = more earnings for LPs

---

## 7. Pool Discovery

### 7.1 Find All Pools for a Token Pair

```typescript
import { fetchWhirlpoolsByTokenPair, setWhirlpoolsConfig } from "@orca-so/whirlpools";
import { createSolanaRpc, devnet, address } from "@solana/kit";

await setWhirlpoolsConfig("solanaMainnet");
const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");

const pools = await fetchWhirlpoolsByTokenPair(
  rpc,
  address("So11111111111111111111111111111111111111112"), // SOL
  address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")  // USDC
);

for (const pool of pools) {
  if (pool.initialized) {
    console.log("Pool Address:", pool.address);
    console.log("Tick Spacing:", pool.tickSpacing);
    console.log("Fee Rate:", pool.feeRate);
    console.log("Liquidity:", pool.liquidity);
    console.log("Current Price:", pool.price);
  } else {
    console.log("Uninitialized pool at:", pool.address);
  }
}
```

### 7.2 Fetch Specific Pool by Tick Spacing

```typescript
import { fetchConcentratedLiquidityPool, PoolInfo } from "@orca-so/whirlpools";

const poolInfo = await fetchConcentratedLiquidityPool(
  rpc,
  address("TOKEN_A_MINT"),
  address("TOKEN_B_MINT"),
  64 // tick spacing for 0.3% fee tier
);

if (poolInfo.initialized) {
  console.log("Pool exists:", poolInfo.address);
} else {
  console.log("Pool not created yet");
}
```

### 7.3 Derive Pool Address (PDA)

```typescript
import { getWhirlpoolAddress } from "@orca-so/whirlpools-client";
import { address } from "@solana/kit";

const whirlpoolConfigAddress = address("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ"); // Mainnet config
const tokenMintA = address("So11111111111111111111111111111111111111112"); // SOL
const tokenMintB = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC  
const tickSpacing = 64;

const whirlpoolPda = await getWhirlpoolAddress(
  whirlpoolConfigAddress,
  tokenMintA,
  tokenMintB,
  tickSpacing
);

console.log("Pool Address:", whirlpoolPda);
```

### 7.4 Whirlpool Config Addresses

```typescript
const WHIRLPOOL_CONFIGS = {
  solanaMainnet: "2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ",
  solanaDevnet: "FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR",
  eclipseMainnet: "...", // Check docs for latest
  eclipseTestnet: "...",
};

const WHIRLPOOL_PROGRAM_ID = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
```

---

## 8. Key Gotchas

### 8.1 Critical: Update Fees Before Collecting

**You MUST call `update_fees_and_rewards` before collecting, or you will receive 0 tokens!**

The new SDK handles this automatically, but if using low-level instructions:

```typescript
// The position account stores fees/rewards as checkpoints.
// update_fees_and_rewards calculates what's owed since last checkpoint
// Without this step, fee_owed_a, fee_owed_b, and reward amounts will be 0

// High-level SDK handles this automatically in harvestPosition()
// If using low-level, ensure you include UpdateFeesAndRewards instruction first
```

### 8.2 Tick Array Initialization

- **Tick arrays must be initialized** before opening positions at those tick ranges
- Each tick array costs ~0.07 SOL rent (~10KB account)
- The SDK's `initTickArrayForTicks()` handles this, but be aware of the cost
- **Dynamic Tick Arrays** (new feature) reduce initial costs significantly

```typescript
// Check and initialize tick arrays before opening position
const initTx = await pool.initTickArrayForTicks(
  [tickLower, tickUpper],
  wallet.publicKey
);
if (initTx) {
  await initTx.buildAndExecute();
}
```

### 8.3 Token Order Matters

- **Token A must have the smaller mint address** (lexicographically)
- The SDK handles sorting, but be aware when deriving PDAs manually
- If your tokens are in the wrong order, you won't find the pool

```typescript
// SDK functions automatically sort tokens
// But if doing manual PDA derivation:
function sortTokenMints(mintA: string, mintB: string): [string, string] {
  return mintA < mintB ? [mintA, mintB] : [mintB, mintA];
}
```

### 8.4 Slippage and Price Movement

- Slippage tolerance is in **basis points** (100 = 1%)
- If price moves beyond your range while opening a position, you get **one-sided liquidity**
- Use appropriate slippage for market conditions (higher in volatile markets)

### 8.5 RPC Rate Limits

- Public RPC endpoints have rate limits (~40 req/s for Helius free tier)
- Implement caching for frequently accessed data (pools, positions)
- Batch requests when fetching multiple positions
- Consider dedicated RPC providers for production

```typescript
// Good practice: cache pool data
const poolCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds

async function getCachedPool(address: string) {
  const cached = poolCache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await fetchWhirlpool(rpc, address);
  poolCache.set(address, { data, timestamp: Date.now() });
  return data;
}
```

### 8.6 Transaction Size Limits

- Close position may require **multiple transactions** (executed serially)
- Complex operations may exceed single transaction limits
- The SDK returns arrays of transactions when needed

```typescript
// Legacy SDK returns array - execute in order!
const txs = await pool.closePosition(...);
for (const tx of txs) {
  await tx.buildAndExecute();
}
```

### 8.7 Position NFT Ownership

- Positions are represented as **NFTs** (mint amount = 1)
- The position authority (owner of the NFT) must sign liquidity operations
- Position bundles can hold multiple positions in one account

### 8.8 Common Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| `TickArrayIndexOutOfBounds` | Swap crossed too many tick arrays | Reduce swap size or use swapV2 |
| `InvalidTickArraySequence` | Tick arrays not in correct order | Check tick array derivation |
| `LiquidityZero` | Trying to add/remove 0 liquidity | Ensure amounts are > 0 |
| `TokenMaxExceeded` | Slippage exceeded | Increase slippage tolerance |
| `InvalidTickSpacing` | Using wrong tick spacing for pool | Check pool's actual tick spacing |
| `LiquidityOverflow` | Liquidity calculation overflow | Reduce position size |

### 8.9 SDK Version Compatibility

- **`@orca-so/whirlpools`** (new) uses **Solana Kit / Web3.js v2** - NOT compatible with Web3.js v1
- **`@orca-so/whirlpools-sdk`** (legacy) uses **Web3.js v1 / Anchor** - NOT compatible with Web3.js v2
- Don't mix packages from different SDK generations

### 8.10 Priority Fees for Mainnet

```typescript
import { setPriorityFeeSetting, setComputeUnitMarginMultiplier } from "@orca-so/whirlpools";

// Dynamic priority fees (recommended for mainnet)
setPriorityFeeSetting({
  type: "dynamic",
  maxCapLamports: BigInt(4_000_000), // Cap at 0.004 SOL
});

// Add compute unit margin for complex transactions
setComputeUnitMarginMultiplier(1.1); // 10% buffer
```

---

## Quick Reference: Common Operations

```typescript
// Setup
await setWhirlpoolsConfig("solanaMainnet");
await setRpc("https://api.mainnet-beta.solana.com");

// Find pools
const pools = await fetchWhirlpoolsByTokenPair(rpc, tokenA, tokenB);

// Open position
const { positionAddress, callback } = await openConcentratedPosition(
  poolAddress, { tokenA: amount }, lowerPrice, upperPrice, slippageBps
);
await callback();

// Read positions
const positions = await fetchPositionsForOwner(rpc, walletAddress);

// Harvest fees
const { callback: harvest } = await harvestPosition(positionMint);
await harvest();

// Close position
const closeResult = await closePositionInstructions(rpc, positionMint, slippageBps, wallet);
// send closeResult.instructions

// Add liquidity  
const { callback: add } = await increasePosLiquidity(positionAddress, { tokenA: amount }, slippageBps);
await add();

// Remove liquidity
const decResult = await decreaseLiquidityInstructions(rpc, positionMint, { tokenA: amount }, slippageBps, wallet);
// send decResult.instructions
```

---

## Resources

- **Official Docs:** https://dev.orca.so/
- **GitHub:** https://github.com/orca-so/whirlpools
- **NPM (new SDK):** https://www.npmjs.com/package/@orca-so/whirlpools
- **NPM (legacy SDK):** https://www.npmjs.com/package/@orca-so/whirlpools-sdk
- **Discord:** https://discord.gg/nSwGWn5KSG (#dev-questions channel)
- **Program Explorer:** https://solscan.io/account/whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc
