# Raydium CLMM SDK Guide for LP Position Management

## 1. NPM Packages Needed

### Primary Package
```bash
yarn add @raydium-io/raydium-sdk-v2
# or
npm install @raydium-io/raydium-sdk-v2
```

**Current Version:** `0.2.32-alpha` (as of research date)

### Peer Dependencies
```bash
yarn add @solana/web3.js @solana/spl-token bn.js decimal.js bs58
```

### Complete package.json dependencies:
```json
{
  "dependencies": {
    "@raydium-io/raydium-sdk-v2": "0.2.32-alpha",
    "@solana/spl-token": "^0.4.6",
    "@solana/web3.js": "^1.95.3",
    "bn.js": "^5.2.1",
    "bs58": "^5.0.0",
    "decimal.js": "^10.4.3"
  }
}
```

### Key Imports
```typescript
import { 
  Raydium,
  ApiV3PoolInfoConcentratedItem,
  TickUtils,
  PoolUtils,
  ClmmKeys,
  ClmmPositionLayout,
  PositionUtils,
  PositionInfoLayout,
  CLMM_PROGRAM_ID,
  DEVNET_PROGRAM_ID,
  TxVersion,
  parseTokenAccountResp
} from '@raydium-io/raydium-sdk-v2'
```

---

## 2. SDK Initialization

```typescript
import { Raydium, TxVersion, parseTokenAccountResp, DEV_API_URLS } from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'

// Configuration
const owner = Keypair.fromSecretKey(bs58.decode('<YOUR_PRIVATE_KEY>'))
const connection = new Connection('<YOUR_RPC_URL>')
const txVersion = TxVersion.V0 // or TxVersion.LEGACY
const cluster = 'mainnet' as 'mainnet' | 'devnet'

let raydium: Raydium | undefined

export const initSdk = async (params?: { loadToken?: boolean }) => {
  if (raydium) return raydium
  
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
    // For devnet, add these URL configs:
    ...(cluster === 'devnet' ? {
      urlConfigs: {
        ...DEV_API_URLS,
        BASE_HOST: 'https://api-v3-devnet.raydium.io',
        OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
        SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
      },
    } : {}),
  })

  return raydium
}
```

---

## 3. Creating a Position

### Method 1: Using `openPositionFromBase` (Specify one token amount)

```typescript
import { ApiV3PoolInfoConcentratedItem, TickUtils, PoolUtils, ClmmKeys } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import Decimal from 'decimal.js'

const createPosition = async () => {
  const raydium = await initSdk()

  // Fetch pool info
  const poolId = '61R1ndXxvsWXXkWSyNkCxnzwd3zUNB8Q2ibmkiLPC8ht' // RAY-USDC
  let poolInfo: ApiV3PoolInfoConcentratedItem
  let poolKeys: ClmmKeys | undefined

  if (raydium.cluster === 'mainnet') {
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    poolInfo = data[0] as ApiV3PoolInfoConcentratedItem
  } else {
    const data = await raydium.clmm.getPoolInfoFromRpc(poolId)
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
  }

  // Define position parameters
  const inputAmount = 1.0 // Amount of token A (e.g., RAY)
  const [startPrice, endPrice] = [0.5, 2.0] // Price range

  // Convert prices to ticks
  const { tick: lowerTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(startPrice),
    baseIn: true,
  })

  const { tick: upperTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(endPrice),
    baseIn: true,
  })

  // Calculate required liquidity
  const epochInfo = await raydium.fetchEpochInfo()
  const res = await PoolUtils.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage: 0,
    inputA: true, // true = using token A as input
    tickUpper: Math.max(lowerTick, upperTick),
    tickLower: Math.min(lowerTick, upperTick),
    amount: new BN(new Decimal(inputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0)),
    add: true,
    amountHasFee: true,
    epochInfo,
  })

  // Create the position
  const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
    poolInfo,
    poolKeys,
    tickUpper: Math.max(lowerTick, upperTick),
    tickLower: Math.min(lowerTick, upperTick),
    base: 'MintA', // Which token to use as base
    ownerInfo: {
      useSOLBalance: true, // Use native SOL if WSOL is involved
    },
    baseAmount: new BN(new Decimal(inputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0)),
    otherAmountMax: res.amountSlippageB.amount,
    txVersion,
    // Priority fee configuration
    computeBudgetConfig: {
      units: 600000,
      microLamports: 100000,
    },
  })

  // Execute transaction
  const { txId } = await execute({ sendAndConfirm: true })
  console.log('Position created:', {
    txId,
    nftMint: extInfo.nftMint.toBase58()
  })
}
```

### Method 2: Using `openPositionFromLiquidity` (Specify exact liquidity)

```typescript
const createPositionFromLiquidity = async () => {
  const raydium = await initSdk()
  const poolId = 'YOUR_POOL_ID'
  const slippage = 0.025 // 2.5%

  const data = await raydium.clmm.getPoolInfoFromRpc(poolId)
  const poolInfo = data.poolInfo
  const poolKeys = data.poolKeys

  const inputAmount = 0.5 // Token A amount
  const [startPrice, endPrice] = [100, 200]

  const { tick: lowerTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(startPrice),
    baseIn: true,
  })

  const { tick: upperTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(endPrice),
    baseIn: true,
  })

  const epochInfo = await raydium.fetchEpochInfo()
  const res = await PoolUtils.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage: 0,
    inputA: true,
    tickUpper: Math.max(lowerTick, upperTick),
    tickLower: Math.min(lowerTick, upperTick),
    amount: new BN(new Decimal(inputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0)),
    add: true,
    amountHasFee: true,
    epochInfo,
  })

  const { execute, extInfo } = await raydium.clmm.openPositionFromLiquidity({
    poolInfo,
    poolKeys,
    tickUpper: Math.max(lowerTick, upperTick),
    tickLower: Math.min(lowerTick, upperTick),
    liquidity: res.liquidity,
    amountMaxA: new BN(new Decimal(inputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0)),
    amountMaxB: new BN(new Decimal(res.amountSlippageB.amount.toString()).mul(1 + slippage).toFixed(0)),
    ownerInfo: { useSOLBalance: true },
    txVersion,
    nft2022: true, // Use Token-2022 for position NFT
    computeBudgetConfig: {
      units: 600000,
      microLamports: 10000,
    },
  })

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('Position created:', { txId, nft: extInfo.address.nftMint.toBase58() })
}
```

---

## 4. Reading Position Data

### Fetch All Positions for Wallet

```typescript
import {
  CLMM_PROGRAM_ID,
  getPdaPersonalPositionAddress,
  TickUtils,
  PositionUtils,
  TickArrayLayout,
  U64_IGNORE_RANGE,
  PositionInfoLayout,
} from '@raydium-io/raydium-sdk-v2'
import { PublicKey } from '@solana/web3.js'

const fetchAllPositions = async () => {
  const raydium = await initSdk()
  
  // Get all positions owned by wallet
  const allPositions = await raydium.clmm.getOwnerPositionInfo({
    programId: CLMM_PROGRAM_ID // Use DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID for devnet
  })
  
  console.log(`Found ${allPositions.length} positions`)
  return allPositions
}
```

### Get Detailed Position Info (Range, Liquidity, Fees)

```typescript
const fetchPositionDetails = async (positionNftMint: PublicKey) => {
  const raydium = await initSdk()
  const programId = CLMM_PROGRAM_ID

  // Get position data from PDA
  const positionPubKey = getPdaPersonalPositionAddress(programId, positionNftMint).publicKey
  const positionAccount = await raydium.connection.getAccountInfo(positionPubKey)
  if (!positionAccount) throw new Error('Position not found')
  
  const position = PositionInfoLayout.decode(positionAccount.data)

  // Get pool info
  let poolInfo: ApiV3PoolInfoConcentratedItem
  if (raydium.cluster === 'mainnet') {
    poolInfo = (await raydium.api.fetchPoolById({ 
      ids: position.poolId.toBase58() 
    }))[0] as ApiV3PoolInfoConcentratedItem
  } else {
    const data = await raydium.clmm.getPoolInfoFromRpc(position.poolId.toBase58())
    poolInfo = data.poolInfo
  }

  // Calculate price range
  const priceLower = TickUtils.getTickPrice({
    poolInfo,
    tick: position.tickLower,
    baseIn: true,
  })
  const priceLower = TickUtils.getTickPrice({
    poolInfo,
    tick: position.tickUpper,
    baseIn: true,
  })

  // Calculate pooled amounts
  const epochInfo = await raydium.connection.getEpochInfo()
  const { amountA, amountB } = PositionUtils.getAmountsFromLiquidity({
    poolInfo,
    ownerPosition: position,
    liquidity: position.liquidity,
    slippage: 0,
    add: false,
    epochInfo,
  })

  // Get tick arrays for fee calculation
  const [tickLowerArrayAddress, tickUpperArrayAddress] = [
    TickUtils.getTickArrayAddressByTick(
      new PublicKey(poolInfo.programId),
      new PublicKey(poolInfo.id),
      position.tickLower,
      poolInfo.config.tickSpacing
    ),
    TickUtils.getTickArrayAddressByTick(
      new PublicKey(poolInfo.programId),
      new PublicKey(poolInfo.id),
      position.tickUpper,
      poolInfo.config.tickSpacing
    ),
  ]

  const tickArrayRes = await raydium.connection.getMultipleAccountsInfo([
    tickLowerArrayAddress, 
    tickUpperArrayAddress
  ])
  
  const tickArrayLower = TickArrayLayout.decode(tickArrayRes[0]!.data)
  const tickArrayUpper = TickArrayLayout.decode(tickArrayRes[1]!.data)
  
  const tickLowerState = tickArrayLower.ticks[
    TickUtils.getTickOffsetInArray(position.tickLower, poolInfo.config.tickSpacing)
  ]
  const tickUpperState = tickArrayUpper.ticks[
    TickUtils.getTickOffsetInArray(position.tickUpper, poolInfo.config.tickSpacing)
  ]

  // Get real-time pool data for fee calculation
  const rpcPoolData = await raydium.clmm.getRpcClmmPoolInfo({ poolId: position.poolId })
  
  // Calculate unclaimed fees
  const tokenFees = PositionUtils.GetPositionFeesV2(
    rpcPoolData, 
    position, 
    tickLowerState, 
    tickUpperState
  )
  
  // Calculate unclaimed rewards
  const rewards = PositionUtils.GetPositionRewardsV2(
    rpcPoolData, 
    position, 
    tickLowerState, 
    tickUpperState
  )

  return {
    pool: `${poolInfo.mintA.symbol} - ${poolInfo.mintB.symbol}`,
    nftMint: position.nftMint.toBase58(),
    priceLower: priceLower.price.toString(),
    priceUpper: priceUpper.price.toString(),
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    liquidity: position.liquidity.toString(),
    pooledAmountA: new Decimal(amountA.amount.toString()).div(10 ** poolInfo.mintA.decimals).toString(),
    pooledAmountB: new Decimal(amountB.amount.toString()).div(10 ** poolInfo.mintB.decimals).toString(),
    unclaimedFeeA: new Decimal(tokenFees.tokenFeeAmountA.toString()).div(10 ** poolInfo.mintA.decimals).toString(),
    unclaimedFeeB: new Decimal(tokenFees.tokenFeeAmountB.toString()).div(10 ** poolInfo.mintB.decimals).toString(),
    rewards: rewards.map((r, idx) => ({
      amount: r.toString(),
      mint: poolInfo.rewardDefaultInfos[idx]?.mint.address
    })),
  }
}
```

---

## 5. Removing Liquidity

### Partial Withdrawal (Reduce Liquidity)

```typescript
const decreaseLiquidity = async (
  poolId: string,
  percentToRemove: number = 1.0 // 1.0 = 100%
) => {
  const raydium = await initSdk()

  // Get pool info
  let poolInfo: ApiV3PoolInfoConcentratedItem
  let poolKeys: ClmmKeys | undefined

  if (raydium.cluster === 'mainnet') {
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    poolInfo = data[0] as ApiV3PoolInfoConcentratedItem
  } else {
    const data = await raydium.clmm.getPoolInfoFromRpc(poolId)
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
  }

  // Find user's position in this pool
  const allPositions = await raydium.clmm.getOwnerPositionInfo({ 
    programId: poolInfo.programId 
  })
  const position = allPositions.find(p => p.poolId.toBase58() === poolInfo.id)
  if (!position) throw new Error(`No position found in pool: ${poolInfo.id}`)

  // Calculate liquidity to remove
  const liquidityToRemove = position.liquidity
    .mul(new BN(Math.floor(percentToRemove * 10000)))
    .div(new BN(10000))

  const { execute } = await raydium.clmm.decreaseLiquidity({
    poolInfo,
    poolKeys,
    ownerPosition: position,
    ownerInfo: {
      useSOLBalance: true,
      closePosition: percentToRemove >= 1.0, // Close if removing 100%
    },
    liquidity: liquidityToRemove,
    amountMinA: new BN(0), // Set to 0 for no slippage protection (use higher for production)
    amountMinB: new BN(0),
    txVersion,
    computeBudgetConfig: {
      units: 600000,
      microLamports: 46591500,
    },
  })

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('Liquidity decreased:', { txId })
}
```

### Close Position Completely

```typescript
const closePosition = async (poolId: string) => {
  const raydium = await initSdk()

  let poolInfo: ApiV3PoolInfoConcentratedItem
  let poolKeys: ClmmKeys | undefined

  if (raydium.cluster === 'mainnet') {
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    poolInfo = data[0] as ApiV3PoolInfoConcentratedItem
  } else {
    const data = await raydium.clmm.getPoolInfoFromRpc(poolId)
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
  }

  const allPositions = await raydium.clmm.getOwnerPositionInfo({ 
    programId: poolInfo.programId 
  })
  const position = allPositions.find(p => p.poolId.toBase58() === poolInfo.id)
  if (!position) throw new Error(`No position found in pool: ${poolInfo.id}`)

  // Close position (must have 0 liquidity - use decreaseLiquidity first if needed)
  const { execute } = await raydium.clmm.closePosition({
    poolInfo,
    poolKeys,
    ownerPosition: position,
    txVersion,
  })

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('Position closed:', { txId })
}
```

---

## 6. Rebalancing (Changing Price Range)

CLMM positions have **immutable price ranges**. To rebalance, you must:
1. Remove all liquidity from existing position
2. Close the position (reclaim rent)
3. Open a new position with the new price range

```typescript
const rebalancePosition = async (
  poolId: string,
  newLowerPrice: number,
  newUpperPrice: number
) => {
  const raydium = await initSdk()

  // 1. Get current position
  let poolInfo: ApiV3PoolInfoConcentratedItem
  let poolKeys: ClmmKeys | undefined

  if (raydium.cluster === 'mainnet') {
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    poolInfo = data[0] as ApiV3PoolInfoConcentratedItem
  } else {
    const data = await raydium.clmm.getPoolInfoFromRpc(poolId)
    poolInfo = data.poolInfo
    poolKeys = data.poolKeys
  }

  const allPositions = await raydium.clmm.getOwnerPositionInfo({ 
    programId: poolInfo.programId 
  })
  const oldPosition = allPositions.find(p => p.poolId.toBase58() === poolInfo.id)
  if (!oldPosition) throw new Error('No position to rebalance')

  // 2. Remove all liquidity and close position
  const { execute: executeDecrease } = await raydium.clmm.decreaseLiquidity({
    poolInfo,
    poolKeys,
    ownerPosition: oldPosition,
    ownerInfo: {
      useSOLBalance: true,
      closePosition: true, // Close in same tx
    },
    liquidity: oldPosition.liquidity,
    amountMinA: new BN(0),
    amountMinB: new BN(0),
    txVersion,
  })
  
  const { txId: closeTxId } = await executeDecrease({ sendAndConfirm: true })
  console.log('Old position closed:', closeTxId)

  // Wait a moment for state to update
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 3. Refresh token accounts
  await raydium.account.fetchWalletTokenAccounts({ forceUpdate: true })

  // 4. Calculate new position parameters
  const { tick: newLowerTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(newLowerPrice),
    baseIn: true,
  })
  const { tick: newUpperTick } = TickUtils.getPriceAndTick({
    poolInfo,
    price: new Decimal(newUpperPrice),
    baseIn: true,
  })

  // Get current token balances to determine how much to deposit
  const tokenABalance = raydium.account.tokenAccounts.find(
    t => t.mint.toBase58() === poolInfo.mintA.address
  )?.amount || new BN(0)

  const epochInfo = await raydium.fetchEpochInfo()
  const res = await PoolUtils.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage: 0.01,
    inputA: true,
    tickUpper: Math.max(newLowerTick, newUpperTick),
    tickLower: Math.min(newLowerTick, newUpperTick),
    amount: tokenABalance,
    add: true,
    amountHasFee: true,
    epochInfo,
  })

  // 5. Open new position
  const { execute: executeOpen, extInfo } = await raydium.clmm.openPositionFromBase({
    poolInfo,
    poolKeys,
    tickUpper: Math.max(newLowerTick, newUpperTick),
    tickLower: Math.min(newLowerTick, newUpperTick),
    base: 'MintA',
    ownerInfo: { useSOLBalance: true },
    baseAmount: tokenABalance,
    otherAmountMax: res.amountSlippageB.amount,
    txVersion,
    computeBudgetConfig: {
      units: 600000,
      microLamports: 100000,
    },
  })

  const { txId: openTxId } = await executeOpen({ sendAndConfirm: true })
  console.log('New position opened:', {
    txId: openTxId,
    nftMint: extInfo.nftMint.toBase58()
  })
}
```

---

## 7. Fee Structure

### CLMM Fee Tiers

| Fee Tier | Trade Fee Rate | Tick Spacing | Best For |
|----------|---------------|--------------|----------|
| 0.01% (1 bps) | 100 | 1 | Very stable pairs (stablecoins) |
| 0.05% (5 bps) | 500 | 1 | Tighter ranges |
| 0.25% (25 bps) | 2500 | 60 | Most pairs (default) |
| 1.00% (100 bps) | 10000 | 120 | Exotic/volatile pairs |

### Fee Distribution
- **84%** → Liquidity Providers
- **12%** → RAY Buybacks
- **4%** → Treasury

### Config IDs (Mainnet)
```typescript
const CLMM_CONFIGS = {
  '9iFER3bpjf1PTTCQCfTRu17EJgvsxo9pVyA9QWwEuX4x': {
    index: 4,
    tradeFeeRate: 100,  // 0.01%
    tickSpacing: 1,
    description: 'Best for very stable pairs',
  },
  '3XCQJQryqpDvvZBfGxR7CLAw5dpGJ9aa7kt1jRLdyxuZ': {
    index: 5,
    tradeFeeRate: 500,  // 0.05%
    tickSpacing: 1,
    description: 'Best for tighter ranges',
  },
  'E64NGkDLLCdQ2yFNPcavaKptrEgmiQaNykUuLC1Qgwyp': {
    index: 1,
    tradeFeeRate: 2500, // 0.25%
    tickSpacing: 60,
    description: 'Best for most pairs',
  },
  'A1BBtTYJd4i3xU8D6Tc2FzU6ZN4oXZWXKZnCxwbHXr8x': {
    index: 3,
    tradeFeeRate: 10000, // 1%
    tickSpacing: 120,
    description: 'Best for exotic pairs',
  },
}
```

### Collecting Fees
Fees are collected automatically when you `decreaseLiquidity`. To claim fees only:

```typescript
const claimFees = async (poolId: string) => {
  const raydium = await initSdk()
  // ... get poolInfo and position ...

  // Decrease liquidity with 0 amount to just claim fees
  const { execute } = await raydium.clmm.decreaseLiquidity({
    poolInfo,
    poolKeys,
    ownerPosition: position,
    ownerInfo: { useSOLBalance: true, closePosition: false },
    liquidity: new BN(0), // 0 liquidity = claim fees only
    amountMinA: new BN(0),
    amountMinB: new BN(0),
    txVersion,
  })

  const { txId } = await execute({ sendAndConfirm: true })
  console.log('Fees claimed:', txId)
}
```

---

## 8. Pool Discovery

### Find Pools by Token Pair

```typescript
import { PoolFetchType } from '@raydium-io/raydium-sdk-v2'

const findPoolsByMints = async (mint1: string, mint2?: string) => {
  const raydium = await initSdk()

  const pools = await raydium.api.fetchPoolByMints({
    mint1, // Required
    mint2, // Optional - if omitted, returns all pools with mint1
    type: PoolFetchType.Concentrated, // Only CLMM pools
    sort: 'liquidity',
    order: 'desc',
    page: 1,
  })

  return pools.data
}

// Example: Find all SOL-USDC CLMM pools
const solMint = 'So11111111111111111111111111111111111111112'
const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const pools = await findPoolsByMints(solMint, usdcMint)
```

### Fetch Pool by ID

```typescript
const fetchPoolById = async (poolId: string) => {
  const raydium = await initSdk()

  // Mainnet - via API
  const data = await raydium.api.fetchPoolById({ ids: poolId })
  const poolInfo = data[0] as ApiV3PoolInfoConcentratedItem

  // Validate it's a CLMM pool
  const isClmm = poolInfo.type === 'Concentrated'
  
  return poolInfo
}
```

### Get Pool Info from RPC (Devnet or fresh pools)

```typescript
const fetchPoolFromRpc = async (poolId: string) => {
  const raydium = await initSdk()

  // RPC method - works for devnet and newly created pools
  const { poolInfo, poolKeys } = await raydium.clmm.getPoolInfoFromRpc(poolId)
  
  return { poolInfo, poolKeys }
}
```

### List All Pools

```typescript
const listPools = async () => {
  const raydium = await initSdk()

  const pools = await raydium.api.getPoolList({
    type: PoolFetchType.Concentrated,
    sort: 'liquidity',
    order: 'desc',
    pageSize: 100,
    page: 1,
  })

  return pools
}
```

---

## 9. Key Gotchas & Best Practices

### Rate Limits & RPC Issues

1. **Use a paid RPC node** - Free nodes will cause issues
   ```typescript
   // Don't do this:
   const connection = new Connection(clusterApiUrl('mainnet-beta'))
   
   // Do this:
   const connection = new Connection('https://your-paid-rpc.com')
   ```

2. **API vs RPC data**
   - API data is cached (faster, but slightly stale)
   - RPC data is real-time (slower, but accurate)
   - For price-sensitive operations, refresh from RPC:
   ```typescript
   const rpcData = await raydium.clmm.getRpcClmmPoolInfo({ poolId: poolInfo.id })
   poolInfo.price = rpcData.currentPrice
   ```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `block height exceeded` | Transaction expired | Increase priority fee |
| `exceeded CUs meter` | Insufficient compute units | Increase `units` in computeBudgetConfig |
| `fetchPoolById returns null` | Pool not synced to API | Use `getPoolInfoFromRpc` instead |
| `cannot found target token accounts` | Missing ATA | SDK creates them, ensure `useSOLBalance: true` |
| `0x10001a9` (Devnet) | Wrong market program ID | Use SDK's createMarket for devnet |

### Priority Fees

```typescript
// Always set priority fees for reliable execution
computeBudgetConfig: {
  units: 600000,           // Compute units
  microLamports: 100000,   // Priority fee (adjust based on network congestion)
}

// For high-priority transactions (Jito tips)
txTipConfig: {
  address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
  amount: new BN(10000000), // 0.01 SOL
}
```

### Position Management Best Practices

1. **Always check if position is in range** before operations
   ```typescript
   const isInRange = poolInfo.price >= priceLower && poolInfo.price <= priceUpper
   ```

2. **Handle Token-2022 correctly**
   ```typescript
   const { execute } = await raydium.clmm.openPositionFromLiquidity({
     // ...
     nft2022: true, // Use Token-2022 for position NFT
   })
   ```

3. **Slippage protection** - Never use 0 in production
   ```typescript
   amountMinA: actualAmount.mul(new BN(9500)).div(new BN(10000)), // 5% slippage
   ```

4. **Refresh token accounts** after transactions
   ```typescript
   await raydium.account.fetchWalletTokenAccounts({ forceUpdate: true })
   ```

### Program IDs

```typescript
// Mainnet
const CLMM_PROGRAM_ID = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK')
const CLMM_LOCK_PROGRAM_ID = new PublicKey('LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE')

// Devnet
const DEV_CLMM_PROGRAM_ID = new PublicKey('DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH')
const DEV_CLMM_LOCK_PROGRAM_ID = new PublicKey('DRay25Usp3YJAi7beckgpGUC7mGJ2cR1AVPxhYfwVCUX')
```

### Useful Links

- **SDK Repo:** https://github.com/raydium-io/raydium-sdk-V2
- **Demo Repo:** https://github.com/raydium-io/raydium-sdk-V2-demo
- **Docs:** https://docs.raydium.io/raydium
- **NPM:** https://www.npmjs.com/package/@raydium-io/raydium-sdk-v2
