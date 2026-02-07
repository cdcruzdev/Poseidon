# Meteora DLMM SDK - Comprehensive Guide

> **Last Updated:** February 2026  
> **Focus:** DLMM (Dynamic Liquidity Market Maker) pools on Solana  
> **SDK Version:** 1.9.3+

## Table of Contents

1. [NPM Packages](#1-npm-packages-needed)
2. [Creating a Position](#2-creating-a-position)
3. [Reading Position Data](#3-reading-position-data)
4. [Removing Liquidity](#4-removing-liquidity)
5. [Rebalancing](#5-rebalancing)
6. [Fee Structure](#6-fee-structure)
7. [Pool Discovery](#7-pool-discovery)
8. [Key Gotchas](#8-key-gotchas--best-practices)

---

## 1. NPM Packages Needed

### Primary Package

```bash
npm install @meteora-ag/dlmm @solana/web3.js
```

### Full Dependencies (with Anchor)

```bash
npm install @meteora-ag/dlmm @coral-xyz/anchor @solana/web3.js
```

### Package.json Dependencies (from SDK source)

```json
{
  "dependencies": {
    "@meteora-ag/dlmm": "^1.9.3",
    "@coral-xyz/anchor": "0.31.0",
    "@coral-xyz/borsh": "0.31.0",
    "@solana/buffer-layout": "^4.0.1",
    "@solana/spl-token": "^0.4.6",
    "@solana/web3.js": "^1.91.6",
    "bn.js": "^5.2.1",
    "decimal.js": "^10.4.2"
  }
}
```

### Alternative Package (Public SDK)

There's also `@meteora-ag/dlmm-sdk-public` but the primary package `@meteora-ag/dlmm` is recommended.

### Key Resources

- **NPM:** https://www.npmjs.com/package/@meteora-ag/dlmm
- **GitHub:** https://github.com/MeteoraAg/dlmm-sdk
- **API:** https://dlmm-api.meteora.ag/pair/all
- **Docs:** https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk

---

## 2. Creating a Position

### Basic Initialization

```typescript
import DLMM from '@meteora-ag/dlmm';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import BN from 'bn.js';

// Setup connection
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Get pool address from API: https://dlmm-api.meteora.ag/pair/all
const poolAddress = new PublicKey('ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq');

// Create DLMM instance
const dlmmPool = await DLMM.create(connection, poolAddress);

// For multiple pools
const pools = await DLMM.createMultiple(connection, [poolAddress, otherPoolAddress]);
```

### Strategy Types

```typescript
import { StrategyType } from '@meteora-ag/dlmm';

// Available strategies:
// StrategyType.Spot   - Uniform distribution (most common, flexible)
// StrategyType.Curve  - Concentrated around active price (best for stables)
// StrategyType.BidAsk - Inverse curve, more liquidity at edges (DCA strategies)
```

### Creating a Balanced Position

```typescript
import { sendAndConfirmTransaction } from '@solana/web3.js';

// Get the active bin (current price point)
const activeBin = await dlmmPool.getActiveBin();
console.log('Active Bin ID:', activeBin.binId);
console.log('Current Price:', dlmmPool.fromPricePerLamport(Number(activeBin.price)));

// Define range (10 bins on each side = 21 bins total)
const TOTAL_RANGE_INTERVAL = 10;
const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

// Define amounts (in lamports/smallest unit)
const totalXAmount = new BN(1 * 10 ** 9);  // 1 token X
const totalYAmount = new BN(250 * 10 ** 6); // 250 token Y (if USDC with 6 decimals)

// Generate new position keypair
const positionKeypair = new Keypair();

// Create position and add liquidity
const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  positionPubKey: positionKeypair.publicKey,
  user: wallet.publicKey,
  totalXAmount,
  totalYAmount,
  strategy: {
    maxBinId,
    minBinId,
    strategyType: StrategyType.Spot,
  },
  slippage: 1, // 1% slippage tolerance
});

// Sign and send (note: position keypair must sign!)
const txHash = await sendAndConfirmTransaction(
  connection,
  createPositionTx,
  [wallet, positionKeypair]
);
```

### Creating a One-Sided Position (Single Token)

```typescript
// One-sided position: Only provide Token X above current price
const minBinId = activeBin.binId;
const maxBinId = activeBin.binId + 20; // 20 bins above current price

const totalXAmount = new BN(100 * 10 ** 9);
const totalYAmount = new BN(0); // Zero of token Y

const positionKeypair = new Keypair();

const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  positionPubKey: positionKeypair.publicKey,
  user: wallet.publicKey,
  totalXAmount,
  totalYAmount,
  strategy: {
    maxBinId,
    minBinId,
    strategyType: StrategyType.Spot,
  },
});

const txHash = await sendAndConfirmTransaction(
  connection,
  createPositionTx,
  [wallet, positionKeypair]
);
```

### Adding Liquidity to Existing Position

```typescript
// Add more liquidity to an existing position
const addLiquidityTx = await dlmmPool.addLiquidityByStrategy({
  positionPubKey: existingPositionPubKey, // Your existing position public key
  user: wallet.publicKey,
  totalXAmount: new BN(50 * 10 ** 9),
  totalYAmount: new BN(125 * 10 ** 6),
  strategy: {
    maxBinId,
    minBinId,
    strategyType: StrategyType.Spot,
  },
  slippage: 1,
});

const txHash = await sendAndConfirmTransaction(
  connection,
  addLiquidityTx,
  [wallet] // No position keypair needed for existing position
);
```

### Quote Position Creation Cost

```typescript
// Get cost estimate before creating position
const quote = await dlmmPool.quoteCreatePosition({
  strategy: {
    minBinId,
    maxBinId,
    strategyType: StrategyType.Spot,
  }
});

console.log('Position creation cost:', quote);
```

---

## 3. Reading Position Data

### Get User Positions for a Pool

```typescript
// Get all positions for a user in this specific pool
const { activeBin, userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
  wallet.publicKey
);

console.log('Number of positions:', userPositions.length);
console.log('Active bin ID:', activeBin.binId);
```

### Position Data Structure

```typescript
interface LbPosition {
  publicKey: PublicKey;        // Position account address
  positionData: PositionData;  // Detailed position info
  version: PositionVersion;    // V1 or V2
}

interface PositionData {
  totalXAmount: string;        // Total token X in position
  totalYAmount: string;        // Total token Y in position
  positionBinData: PositionBinData[];  // Per-bin breakdown
  lastUpdatedAt: BN;
  upperBinId: number;          // Max bin ID of position range
  lowerBinId: number;          // Min bin ID of position range
  feeX: BN;                    // Unclaimed fees in token X
  feeY: BN;                    // Unclaimed fees in token Y
  rewardOne: BN;               // LM reward 1
  rewardTwo: BN;               // LM reward 2
  feeOwner: PublicKey;
  totalClaimedFeeXAmount: BN;
  totalClaimedFeeYAmount: BN;
  owner: PublicKey;
}

interface PositionBinData {
  binId: number;
  price: string;
  pricePerToken: string;
  binXAmount: string;          // Total X in this bin
  binYAmount: string;          // Total Y in this bin
  binLiquidity: string;        // Total liquidity shares in bin
  positionLiquidity: string;   // Your liquidity shares
  positionXAmount: string;     // Your X amount
  positionYAmount: string;     // Your Y amount
  positionFeeXAmount: string;  // Your unclaimed X fees
  positionFeeYAmount: string;  // Your unclaimed Y fees
  positionRewardAmount: string[];
}
```

### Reading Position Details

```typescript
for (const position of userPositions) {
  console.log('Position:', position.publicKey.toString());
  console.log('Lower Bin ID:', position.positionData.lowerBinId);
  console.log('Upper Bin ID:', position.positionData.upperBinId);
  console.log('Total X Amount:', position.positionData.totalXAmount);
  console.log('Total Y Amount:', position.positionData.totalYAmount);
  console.log('Unclaimed Fee X:', position.positionData.feeX.toString());
  console.log('Unclaimed Fee Y:', position.positionData.feeY.toString());
  
  // Check if position is in range
  const isInRange = 
    activeBin.binId >= position.positionData.lowerBinId && 
    activeBin.binId <= position.positionData.upperBinId;
  console.log('In Range:', isInRange);
  
  // Per-bin breakdown
  for (const binData of position.positionData.positionBinData) {
    console.log(`  Bin ${binData.binId}: X=${binData.positionXAmount}, Y=${binData.positionYAmount}`);
  }
}
```

### Get Single Position by Address

```typescript
const position = await dlmmPool.getPosition(positionPublicKey);
console.log('Position data:', position.positionData);
```

### Get All User Positions Across All Pools

```typescript
// Get ALL positions for a user across ALL DLMM pools
const allPositions = await DLMM.getAllLbPairPositionsByUser(
  connection,
  wallet.publicKey
);

// Returns Map<string, PositionInfo>
allPositions.forEach((positionInfo, poolAddress) => {
  console.log(`Pool: ${poolAddress}`);
  console.log(`Positions: ${positionInfo.lbPairPositionsData.length}`);
});
```

### Get Active Bin Info

```typescript
const activeBin = await dlmmPool.getActiveBin();

console.log('Active Bin ID:', activeBin.binId);
console.log('Price (lamport):', activeBin.price);
console.log('Price per token:', activeBin.pricePerToken);
console.log('X Amount:', activeBin.xAmount.toString());
console.log('Y Amount:', activeBin.yAmount.toString());
```

### Get Bins Around Active Price

```typescript
// Get 10 bins on each side of active bin
const { activeBin, bins } = await dlmmPool.getBinsAroundActiveBin(10, 10);

for (const bin of bins) {
  console.log(`Bin ${bin.binId}: Price=${bin.pricePerToken}, X=${bin.xAmount}, Y=${bin.yAmount}`);
}
```

### Price/Bin Conversion Utilities

```typescript
// Convert bin ID to price
const price = dlmmPool.getPriceOfBinByBinId(activeBin.binId);

// Convert price to bin ID
const binId = dlmmPool.getBinIdFromPrice(1.0, true); // true = round down

// Convert lamport price to readable price
const readablePrice = dlmmPool.fromPricePerLamport(Number(activeBin.price));

// Convert readable price to lamport price
const lamportPrice = dlmmPool.toPricePerLamport(100.5);
```

---

## 4. Removing Liquidity

### Remove Partial Liquidity

```typescript
// Get user positions first
const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(wallet.publicKey);
const position = userPositions[0];

// Get bin IDs from position
const binIds = position.positionData.positionBinData.map(bin => bin.binId);
const fromBinId = binIds[0];
const toBinId = binIds[binIds.length - 1];

// Remove 50% of liquidity (5000 basis points = 50%)
const removeLiquidityTx = await dlmmPool.removeLiquidity({
  user: wallet.publicKey,
  position: position.publicKey,
  fromBinId,
  toBinId,
  bps: new BN(5000), // 50% in basis points (100% = 10000)
  shouldClaimAndClose: false, // Keep position open
});

// Can return single tx or array of txs
const txs = Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx];

for (const tx of txs) {
  const txHash = await sendAndConfirmTransaction(connection, tx, [wallet], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  console.log('Remove liquidity tx:', txHash);
}
```

### Remove All Liquidity and Close Position

```typescript
const binIds = position.positionData.positionBinData.map(bin => bin.binId);

const removeLiquidityTx = await dlmmPool.removeLiquidity({
  user: wallet.publicKey,
  position: position.publicKey,
  fromBinId: binIds[0],
  toBinId: binIds[binIds.length - 1],
  bps: new BN(10000), // 100% = 10000 bps
  shouldClaimAndClose: true, // Claim fees and close position
});

const txs = Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx];

for (const tx of txs) {
  await sendAndConfirmTransaction(connection, tx, [wallet]);
}
```

### Claim Fees Without Removing Liquidity

```typescript
// Claim swap fees for a single position
const claimFeeTx = await dlmmPool.claimSwapFee({
  owner: wallet.publicKey,
  position: position, // LbPosition object, not just PublicKey
});

if (claimFeeTx) {
  await sendAndConfirmTransaction(connection, claimFeeTx, [wallet]);
}
```

### Claim All Fees from Multiple Positions

```typescript
const claimFeeTxs = await dlmmPool.claimAllSwapFee({
  owner: wallet.publicKey,
  positions: userPositions,
});

for (const tx of claimFeeTxs) {
  await sendAndConfirmTransaction(connection, tx, [wallet]);
}
```

### Claim LM Rewards (if available)

```typescript
// Claim liquidity mining rewards
const claimRewardsTx = await dlmmPool.claimLMReward({
  owner: wallet.publicKey,
  position: position,
});

await sendAndConfirmTransaction(connection, claimRewardsTx, [wallet]);

// Or claim all rewards (fees + LM) at once
const claimAllTxs = await dlmmPool.claimAllRewards({
  owner: wallet.publicKey,
  positions: userPositions,
});
```

### Close Empty Position

```typescript
// Close a position that has no liquidity (recovers rent)
const closeTx = await dlmmPool.closePosition({
  owner: wallet.publicKey,
  position: position, // LbPosition object
});

await sendAndConfirmTransaction(connection, closeTx, [wallet]);

// Or close only if empty
const closeIfEmptyTx = await dlmmPool.closePositionIfEmpty({
  owner: wallet.publicKey,
  position: position,
});
```

---

## 5. Rebalancing

### Understanding Rebalancing

**DLMM does NOT have a native "change range" function.** Once a position is created with a specific bin range, you cannot modify that range.

**To rebalance, you must:**
1. Remove liquidity from the old position
2. Close the old position (optional, recovers rent)
3. Open a new position with the new desired range

### Complete Rebalancing Example

```typescript
async function rebalancePosition(
  dlmmPool: DLMM,
  wallet: Keypair,
  oldPosition: LbPosition,
  newMinBinId: number,
  newMaxBinId: number
) {
  // Step 1: Remove all liquidity from old position
  const binIds = oldPosition.positionData.positionBinData.map(bin => bin.binId);
  
  const removeTxs = await dlmmPool.removeLiquidity({
    user: wallet.publicKey,
    position: oldPosition.publicKey,
    fromBinId: binIds[0],
    toBinId: binIds[binIds.length - 1],
    bps: new BN(10000), // 100%
    shouldClaimAndClose: true, // Claim fees and close
  });

  const removeTxArray = Array.isArray(removeTxs) ? removeTxs : [removeTxs];
  for (const tx of removeTxArray) {
    await sendAndConfirmTransaction(connection, tx, [wallet]);
  }
  
  // Step 2: Get current balances (what we withdrew)
  // In production, you'd fetch actual token balances here
  
  // Step 3: Create new position with new range
  const newPositionKeypair = new Keypair();
  const activeBin = await dlmmPool.getActiveBin();
  
  const createTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: newPositionKeypair.publicKey,
    user: wallet.publicKey,
    totalXAmount: new BN(withdrawnXAmount), // Your withdrawn amounts
    totalYAmount: new BN(withdrawnYAmount),
    strategy: {
      minBinId: newMinBinId,
      maxBinId: newMaxBinId,
      strategyType: StrategyType.Spot,
    },
    slippage: 1,
  });

  await sendAndConfirmTransaction(connection, createTx, [wallet, newPositionKeypair]);
  
  return newPositionKeypair.publicKey;
}
```

### Auto-Rebalancing Logic

```typescript
async function checkAndRebalanceIfNeeded(
  dlmmPool: DLMM,
  position: LbPosition,
  maxDistanceFromCenter: number = 5 // bins
) {
  const activeBin = await dlmmPool.getActiveBin();
  const { lowerBinId, upperBinId } = position.positionData;
  
  // Calculate center of position
  const centerBinId = Math.floor((lowerBinId + upperBinId) / 2);
  
  // Check if active bin is too far from center
  const distanceFromCenter = Math.abs(activeBin.binId - centerBinId);
  
  if (distanceFromCenter > maxDistanceFromCenter) {
    console.log('Rebalance needed! Active bin too far from position center');
    
    // Calculate new range centered on active bin
    const rangeWidth = upperBinId - lowerBinId;
    const newMinBinId = activeBin.binId - Math.floor(rangeWidth / 2);
    const newMaxBinId = activeBin.binId + Math.floor(rangeWidth / 2);
    
    // Trigger rebalance
    return { needsRebalance: true, newMinBinId, newMaxBinId };
  }
  
  return { needsRebalance: false };
}
```

### Upcoming: Native Rebalance Function

According to Meteora's 2025 roadmap, new endpoints are planned:
- `increase_position_length` - Extend position range
- `decrease_position_length` - Shrink position range  
- `rebalance_liquidity` - Fine-tune holdings

Until these are released, use the close-and-reopen method.

---

## 6. Fee Structure

### Fee Components

DLMM fees have two components:

```
Total Fee (f_s) = Base Fee (f_b) + Variable Fee (f_v)
```

### Base Fee

The minimum fee charged per swap:

```
f_b = B × s × 10^base_fee_power_factor
```

Where:
- `B` = Base factor (amplification)
- `s` = Bin step

**Example:** If bin step is 25 bps (0.25%) and base factor is 10000:
- Base fee ≈ 0.25% per swap

### Variable Fee (Dynamic Fee)

Increases during volatile conditions:

```
f_v(k) = A × (v_a(k) × s)²
```

Where:
- `A` = Variable fee control parameter
- `v_a(k)` = Volatility accumulator
- `s` = Bin step
- `k` = Number of bins crossed

**Key insight:** Fees increase when:
1. Many bins are crossed (large price impact)
2. High frequency of trades (volatility accumulator builds up)

### Protocol Fees

- **Standard DLMM Pools:** 5% of total fee goes to protocol
- **Launch Pools (Bootstrapping):** 20% of total fee goes to protocol

The remaining 95% (or 80%) goes to LPs.

### Reading Fee Info Programmatically

```typescript
// Get fee info for the pool
const feeInfo = dlmmPool.getFeeInfo();

console.log('Base Fee Rate:', feeInfo.baseFeeRatePercentage.toString(), '%');
console.log('Max Fee Rate:', feeInfo.maxFeeRatePercentage.toString(), '%');
console.log('Protocol Fee:', feeInfo.protocolFeePercentage.toString(), '%');

// Get current dynamic fee
const dynamicFee = dlmmPool.getDynamicFee();
console.log('Current Dynamic Fee:', dynamicFee.toString(), '%');
```

### Bin Step Reference

| Bin Step (bps) | Price Change Per Bin | Use Case |
|----------------|---------------------|----------|
| 1 | 0.01% | Stablecoins |
| 5 | 0.05% | Very stable pairs |
| 10 | 0.1% | Correlated assets |
| 25 | 0.25% | Major pairs (SOL/USDC) |
| 50 | 0.5% | Moderately volatile |
| 100 | 1% | Volatile pairs |
| 200+ | 2%+ | Highly volatile/meme |

### Fee Claiming

```typescript
// Check unclaimed fees
const position = userPositions[0];
console.log('Unclaimed X fees:', position.positionData.feeX.toString());
console.log('Unclaimed Y fees:', position.positionData.feeY.toString());

// Fees do NOT auto-compound - you must claim manually
const claimTx = await dlmmPool.claimSwapFee({
  owner: wallet.publicKey,
  position: position,
});
```

---

## 7. Pool Discovery

### Using the Official API

```typescript
// Fetch all DLMM pools
const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
const pools = await response.json();

// Pool data structure
interface PoolInfo {
  address: string;           // Pool public key
  name: string;              // e.g., "SOL-USDC"
  mint_x: string;            // Token X mint
  mint_y: string;            // Token Y mint
  bin_step: number;          // Bin step in bps
  base_fee_percentage: string;
  max_fee_percentage: string;
  protocol_fee_percentage: string;
  liquidity: string;         // TVL
  current_price: number;
  trade_volume_24h: number;
  fees_24h: number;
  apr: number;
  apy: number;
  hide: boolean;
  is_blacklisted: boolean;
}
```

### Find Pool by Token Pair

```typescript
async function findPoolsByTokenPair(
  tokenXMint: string,
  tokenYMint: string
): Promise<PoolInfo[]> {
  const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
  const pools: PoolInfo[] = await response.json();
  
  return pools.filter(pool => 
    (pool.mint_x === tokenXMint && pool.mint_y === tokenYMint) ||
    (pool.mint_x === tokenYMint && pool.mint_y === tokenXMint)
  );
}

// Example: Find all SOL-USDC pools
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const solUsdcPools = await findPoolsByTokenPair(SOL_MINT, USDC_MINT);

// Sort by liquidity to find best pool
solUsdcPools.sort((a, b) => parseFloat(b.liquidity) - parseFloat(a.liquidity));
console.log('Best pool:', solUsdcPools[0]);
```

### Check if Pool Exists On-Chain

```typescript
// Check if a specific pool exists
const pairPubkey = await DLMM.getPairPubkeyIfExists(
  connection,
  new PublicKey(tokenXMint),
  new PublicKey(tokenYMint),
  new BN(binStep),
  new BN(baseFactor),
  new BN(baseFeePowerFactor)
);

if (pairPubkey) {
  console.log('Pool exists:', pairPubkey.toString());
} else {
  console.log('Pool does not exist');
}
```

### Get All On-Chain Pools

```typescript
// Get all LB pairs from the program
const allPairs = await DLMM.getLbPairs(connection);

console.log('Total pools on-chain:', allPairs.length);

for (const pair of allPairs) {
  console.log('Pool:', pair.publicKey.toString());
  console.log('Token X:', pair.account.tokenXMint.toString());
  console.log('Token Y:', pair.account.tokenYMint.toString());
  console.log('Bin Step:', pair.account.binStep);
}
```

### Pool Info from DLMM Instance

```typescript
const dlmmPool = await DLMM.create(connection, poolAddress);

// Access pool state
console.log('Token X Mint:', dlmmPool.tokenX.publicKey.toString());
console.log('Token Y Mint:', dlmmPool.tokenY.publicKey.toString());
console.log('Bin Step:', dlmmPool.lbPair.binStep);
console.log('Active Bin ID:', dlmmPool.lbPair.activeId);
console.log('Reserve X:', dlmmPool.tokenX.amount.toString());
console.log('Reserve Y:', dlmmPool.tokenY.amount.toString());
```

---

## 8. Key Gotchas & Best Practices

### Position Keypair Signing

**Critical:** When creating a new position, you MUST sign with both the wallet AND the position keypair:

```typescript
// ❌ WRONG - will fail
await sendAndConfirmTransaction(connection, tx, [wallet]);

// ✅ CORRECT
const positionKeypair = new Keypair();
await sendAndConfirmTransaction(connection, tx, [wallet, positionKeypair]);
```

### Refresh State Before Operations

```typescript
// Always refresh state before critical operations
await dlmmPool.refetchStates();
const activeBin = await dlmmPool.getActiveBin();
```

### Handle Transaction Arrays

Many functions return either a single Transaction or an array:

```typescript
const result = await dlmmPool.removeLiquidity({...});

// Always handle both cases
const txs = Array.isArray(result) ? result : [result];
for (const tx of txs) {
  await sendAndConfirmTransaction(connection, tx, [wallet]);
}
```

### RPC Rate Limits

```typescript
// Use dedicated RPC for production
const connection = new Connection('YOUR_RPC_ENDPOINT', {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Add delays between rapid calls
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// When fetching multiple positions
for (const pool of pools) {
  const dlmm = await DLMM.create(connection, pool);
  await sleep(100); // Avoid rate limits
}
```

### Slippage Settings

```typescript
// For volatile pairs, increase slippage
const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  // ...
  slippage: 2, // 2% for volatile pairs
});

// For stable pairs
const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
  // ...
  slippage: 0.5, // 0.5% for stables
});
```

### Price Sync Issues

Check if pool price matches market price before depositing:

```typescript
const poolPrice = await dlmmPool.getActiveBin();
const poolPricePerToken = dlmmPool.fromPricePerLamport(Number(poolPrice.price));

// Compare with external price (Jupiter, etc.)
const jupiterPrice = await getJupiterPrice(tokenX, tokenY);

const priceDiff = Math.abs(poolPricePerToken - jupiterPrice) / jupiterPrice;
if (priceDiff > 0.02) { // 2% difference
  console.warn('Pool price significantly different from market!');
  // Consider using syncWithMarketPrice or waiting
}
```

### Sync Pool Price

```typescript
// If pool is out of sync and you have permission
const canSync = dlmmPool.canSyncWithMarketPrice(marketPrice, activeBin.binId);

if (canSync) {
  const syncTx = await dlmmPool.syncWithMarketPrice(
    marketPrice,
    wallet.publicKey
  );
  await sendAndConfirmTransaction(connection, syncTx, [wallet]);
}
```

### Position Size Limits

- **Maximum bins per position:** ~1,400 bins
- **Default bins in UI:** 69 bins
- Cost increases with more bins (rent for bin arrays)

### Common Errors

```typescript
// Error: "Position already exists"
// Solution: Generate a new Keypair for each position

// Error: "Insufficient funds"
// Solution: Ensure you have SOL for rent + tokens for liquidity

// Error: "Bin array not initialized"
// Solution: SDK usually handles this, but you can manually:
const ixs = await dlmmPool.initializeBinArrays([new BN(binArrayIndex)], wallet.publicKey);

// Error: "Slippage exceeded"  
// Solution: Increase slippage parameter or retry
```

### Production Checklist

- [ ] Use dedicated RPC endpoint (not public)
- [ ] Implement retry logic for failed transactions
- [ ] Monitor position status regularly
- [ ] Set up alerts for out-of-range positions
- [ ] Store position public keys for tracking
- [ ] Implement proper error handling
- [ ] Consider compute unit optimization for complex operations
- [ ] Test on devnet first

### Devnet Testing

```typescript
const connection = new Connection('https://api.devnet.solana.com', 'finalized');

const dlmmPool = await DLMM.create(connection, poolAddress, {
  cluster: 'devnet',
});
```

---

## Additional Resources

- **Official Docs:** https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk
- **GitHub SDK:** https://github.com/MeteoraAg/dlmm-sdk
- **Discord:** https://discord.com/channels/841152225564950528/864859354335412224
- **API Explorer:** https://dlmm-api.meteora.ag/pair/all
- **LP Army Tools:** https://www.lparmy.com/community-tools

---

## Quick Reference: Common Operations

| Operation | Method |
|-----------|--------|
| Create pool instance | `DLMM.create(connection, poolAddress)` |
| Get active bin | `dlmmPool.getActiveBin()` |
| Create position | `dlmmPool.initializePositionAndAddLiquidityByStrategy()` |
| Add liquidity | `dlmmPool.addLiquidityByStrategy()` |
| Remove liquidity | `dlmmPool.removeLiquidity()` |
| Claim fees | `dlmmPool.claimSwapFee()` / `claimAllSwapFee()` |
| Close position | `dlmmPool.closePosition()` |
| Get user positions | `dlmmPool.getPositionsByUserAndLbPair()` |
| Get all user positions | `DLMM.getAllLbPairPositionsByUser()` |
| Get fee info | `dlmmPool.getFeeInfo()` |
| Get dynamic fee | `dlmmPool.getDynamicFee()` |
| Refresh state | `dlmmPool.refetchStates()` |
