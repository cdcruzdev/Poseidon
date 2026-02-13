# Poseidon -- LP Aggregator for Solana

Compare and deploy LP positions across Meteora, Orca, and Raydium from one interface.

Built for the Colosseum Agent Hackathon (Feb 2-13, 2026). 100% AI-written code.

## What It Does

Poseidon is an LP management platform for Solana. It solves three problems:

1. **Fragmentation** -- Three major concentrated liquidity DEXs, three different UIs, no way to compare. Poseidon aggregates Meteora DLMM, Orca Whirlpools, and Raydium CLMM into one interface with real-time yield data from each DEX's API.

2. **Complexity** -- Setting up concentrated liquidity requires understanding tick spacing, fee tiers, and range width across different protocols. Poseidon handles all of that: pick your tokens, pick your amount, and we find the best pool and deposit in one click.

3. **Visibility** -- Track all your LP positions across every DEX in one dashboard with current values and fee data pulled directly from on-chain data and DEX APIs.

### Auto-Rebalancing (Default On)

All deposits have auto-rebalancing enabled by default. The Poseidon agent monitors positions and rebalances when price drifts out of range:
- **Max slippage:** 1% (100 bps)
- **Target yield:** 0.05% daily (safe baseline)
- On-chain rebalance config program deployed to mainnet (`HLsgAVzjjBaBR9QCLqV3vjC9LTnR2xtmtB77j1EJQBsZ`)
- Per-position opt-out toggle coming soon (program upgrade ready, pending funding)

### In Progress

- **Close Position** -- Withdraw liquidity back to wallet via DEX-specific withdrawal transactions (Orca/Raydium/Meteora)
- **Meteora position values** -- DLMM bin-based liquidity parsing for deposited/current USD values
- **Per-position rebalance controls** -- Toggle auto-rebalance per position with custom yield targets

### Roadmap

- **Privacy Layer** -- Arcium MPC integration for encrypted position management (devnet prototype complete)

## Architecture

```
poseidon/
  agent/              TypeScript agent + Express API server
    src/
      core/           Aggregator, yield calc, position monitor, fee collector
      dex/            Native adapters for Meteora, Orca, Raydium
      wallet/         AgentWallet, transaction helpers
  programs/
    poseidon-native/  Native Solana program (Rust) -- rebalance config (mainnet)
    poseidon-rebalance/ Anchor program (devnet)
  frontend/           Next.js 14 dashboard
  mobile/             React Native (Expo) mobile app
  tests/              Integration + unit tests (113+ passing)
```

| Layer | Stack |
|-------|-------|
| Agent | TypeScript, @solana/web3.js, Express |
| On-chain | Native Solana program (Rust), BPFLoaderUpgradeable, mainnet |
| Web | Next.js 14, React, TailwindCSS, Solana Wallet Adapter |
| Mobile | React Native, Expo, Solana Mobile Wallet Adapter |

## On-Chain Program

**Poseidon Native:** `HLsgAVzjjBaBR9QCLqV3vjC9LTnR2xtmtB77j1EJQBsZ` (Mainnet)

Stores rebalance preferences on-chain:
- `enable_rebalance` -- opt in with max slippage + min yield thresholds
- `disable_rebalance` -- opt out
- `execute_rebalance` -- agent-only, records rebalance events

Upgrade authority held by project wallet. CI/CD pipeline via GitHub Actions for verifiable builds and upgrades.

## Key Features

- **One-click deposits** across Orca Whirlpools, Raydium CLMM, and Meteora DLMM
- **Real-time pool comparison** with yield scoring, TVL, and fee tier data
- **Position dashboard** with on-chain position data (not transaction history parsing)
- **Estimated 24h yields** calculated per-position using pool volume and fee data from DEX APIs
- **Mobile app** with Solana Mobile Wallet Adapter (MWA) for native wallet connection
- **Responsive design** -- web app works on desktop and mobile browsers

## Fee Model

| Fee | Amount | Details |
|-----|--------|---------|
| Deposit | 0.1% | Aggregation service |
| Performance | 5% of earned LP fees | When auto-rebalance is active |
| Free tier | $0 | Aggregator view + manual management |

## Agent Components

- **Aggregator** -- Fetches and scores pools across all three DEXs
- **Yield Calculator** -- Normalizes APR across different fee structures
- **Position Monitor** -- Tracks range status across DEXs
- **Fee Collector** -- Self-sustaining fee model (deposit + performance)
- **Reasoning Logger** -- Transparent agent decision logging
- **Activity Tracker** -- Full audit trail of agent actions

## Test Coverage

113+ tests across 5 suites:

- `aggregator` -- pool discovery, ranking, cross-DEX comparison
- `fee-collector` -- fee calculation, treasury splits
- `position-monitor` -- rebalance triggers, range detection
- `api-server` -- REST API endpoints
- `arcium-privacy` -- encryption verification

## Getting Started

```bash
# Agent + API server
cd agent && pnpm install && cp .env.example .env && pnpm dev

# Frontend
cd frontend && pnpm install && pnpm dev

# Mobile (requires Android SDK)
cd mobile && npm install && npx expo start

# Native program (requires Rust + Solana CLI)
cd programs/poseidon-native && cargo build-sbf
```

## Mobile App (Coming Soon)

React Native app with Solana Mobile Wallet Adapter (MWA) for native wallet connection. Foundational code is complete: wallet connection, position viewing, and deposit flows are built. Currently in active development and testing.

Built with Expo + Gradle (arm64-v8a). Tested on Samsung Galaxy S25 with MWA wallet connection working.

## License

MIT
