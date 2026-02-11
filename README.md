# Poseidon -- LP Aggregator for Solana

Compare, deploy, and auto-rebalance LP positions across Meteora, Orca, and Raydium from one interface.

Built for the Colosseum Agent Hackathon (Feb 2-12, 2026). 100% AI-written code.

## What It Does

Poseidon is an autonomous LP management agent for Solana. It solves four problems:

1. **Fragmentation** -- Three major concentrated liquidity DEXs, three different UIs, no way to compare. Poseidon aggregates Meteora DLMM, Orca Whirlpools, and Raydium CLMM into one interface with objective yield scoring.

2. **Manual management** -- When price moves out of your LP range, you stop earning. Poseidon monitors 24/7 and rebalances automatically using on-chain opt-in (configurable slippage and yield thresholds).

3. **Privacy** -- LP positions are public on-chain. Poseidon integrates Arcium MPC for encrypted position management so nobody can see your strategy.

4. **Complexity** -- Setting up concentrated liquidity requires understanding tick spacing, fee tiers, and range width. Poseidon offers target yield mode: set your desired daily yield and the agent calculates the optimal range.

## Architecture

```
poseidon/
  agent/              TypeScript agent + Express API server
    src/
      core/           Aggregator, yield calc, position monitor, fee collector
      dex/            Native adapters for Meteora, Orca, Raydium
      wallet/         AgentWallet, transaction helpers
  programs/           Anchor (Rust) on-chain rebalance program
  arcium/             Arcium MPC privacy layer (devnet)
  frontend/           Next.js 14 dashboard
  mobile/             React Native (Expo) mobile app
  tests/              Integration + unit tests (113+ passing)
```

| Layer | Stack |
|-------|-------|
| Agent | TypeScript, @solana/web3.js, Express |
| On-chain | Anchor (Rust), Solana devnet |
| Privacy | Arcium MPC (encrypted state, threshold signatures) |
| Web | Next.js 14, React, TailwindCSS, Solana Wallet Adapter |
| Mobile | React Native, Expo, Solana Mobile Wallet Adapter |

## On-Chain Programs

**Rebalance Program:** `2ro3VBKvqtc86DJVMnZETHMGAtjYFipZwdMFgtZGWscx` (Devnet)

Stores per-user rebalance preferences on-chain:
- `enable_rebalance` -- opt in with max slippage + min yield improvement
- `disable_rebalance` -- opt out
- `execute_rebalance` -- agent-only, records rebalance events

**Arcium MPC:** Deployed to devnet. Handles encrypted deposits and private position state.

## Fee Model

| Fee | Amount | Details |
|-----|--------|---------|
| Deposit | 0.1% | Aggregation service |
| Performance | 5% of earned LP fees | 98% treasury, 2% agent gas |
| Free tier | $0 | Aggregator view, no auto-rebalance |

Users keep 95% of their yield. Poseidon earns when users earn.

## Agent Components

- **Aggregator** -- Fetches and scores pools across all three DEXs
- **Yield Calculator** -- Normalizes APR across different fee structures
- **Position Monitor** -- Tracks range, triggers rebalance when beneficial
- **Fee Collector** -- Self-sustaining fee model (deposit + performance)
- **Migration Analyzer** -- Detects when switching pools would improve yield
- **Reasoning Logger** -- Transparent agent decision logging
- **Activity Tracker** -- Full audit trail of agent actions
- **Price Oracle** -- Real-time price feeds for rebalance decisions

## Test Coverage

113+ tests across 5 suites:

- `aggregator` -- pool discovery, ranking, cross-DEX comparison
- `fee-collector` -- fee calculation, treasury splits
- `position-monitor` -- rebalance triggers, range detection
- `api-server` -- REST API endpoints (5 endpoints, all verified)
- `arcium-privacy` -- encryption verification, wrong-key rejection

## Getting Started

```bash
# Agent + API server
cd agent && pnpm install && cp .env.example .env && pnpm dev

# Frontend
cd frontend && pnpm install && pnpm dev

# Mobile (requires Android SDK)
cd mobile && npm install && npx expo start

# Anchor program
anchor build && anchor deploy --provider.cluster devnet && anchor test
```

## Mobile App

React Native app with Solana Mobile Wallet Adapter (MWA) for native wallet connection. Supports the same deposit flow as web with hot reload dev server.

Built locally with Gradle (arm64-v8a). Tested on Samsung Galaxy S25.

## License

MIT
