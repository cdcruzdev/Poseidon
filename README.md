# Private LP Vault

> Jupiter for LP - with privacy and auto-management

**Colosseum Agent Hackathon 2026**

## The Problem

Providing liquidity on Solana DEXs is powerful but painful:

1. **No Privacy** - Everyone can see your positions, strategies, and net worth
2. **Manual Management** - Price moves out of range, you stop earning, you miss it
3. **Fragmented** - Meteora, Orca, Raydium all have different UIs, no comparison
4. **No Intelligence** - You have to manually calculate optimal ranges

## The Solution

Private LP Vault is an autonomous agent that:

### Aggregates
Find the best LP opportunities across all major Solana DEXs in one place. Compare yields, TVL, volume, and fees instantly.

### Protects
Your positions are private. Using Arcium's encrypted computation, nobody can see what pools you're in or how much you've deposited. Your strategy stays yours.

### Manages
Set a target daily yield (e.g., "I want 0.4%/day on BONK-SOL") and the agent calculates the optimal range, opens the position, and rebalances automatically when needed.

## Features

- **Multi-DEX Support**: Meteora DLMM, Orca Whirlpools, Raydium CLMM
- **Privacy Mode**: Hide positions via Arcium encrypted computation
- **Target Yield Strategy**: Set desired daily yield, agent finds optimal range
- **Auto-Rebalancing**: Price exits range? Agent recenters automatically
- **Smart Gas Management**: Only rebalances when benefit > cost
- **24/7 Autonomous Operation**: Set it and forget it

## How It Works

```
User: "I want to LP in BONK-SOL with 0.4% daily yield"

Agent:
1. Scans Meteora, Orca, Raydium for BONK-SOL pools
2. Compares fees, volume, TVL across all pools
3. Calculates optimal range width for 0.4% yield
4. Opens position on best DEX with calculated range
5. Monitors 24/7, rebalances when price exits range
6. User sees earnings, nobody else sees anything
```

## Architecture

```
lp-vault/
├── agent/              # TypeScript autonomous agent
│   ├── core/
│   │   ├── aggregator.ts      # Multi-DEX pool discovery
│   │   ├── yield-calculator.ts # Range optimization
│   │   └── position-monitor.ts # 24/7 monitoring
│   └── dex/
│       ├── interface.ts       # DEX abstraction layer
│       ├── meteora.ts         # Meteora DLMM adapter
│       ├── orca.ts            # Orca Whirlpools adapter
│       └── raydium.ts         # Raydium CLMM adapter
├── arcium/             # Privacy layer (Arcis)
│   ├── deposit/        # Encrypted deposits
│   └── state/          # Hidden position state
├── programs/           # Anchor programs
└── app/                # Next.js dashboard
```

## Revenue Model

| Feature | Fee |
|---------|-----|
| Deposit | 0.1% of position value |
| Performance | 5% of earned fees |
| Free Tier | Aggregator view only (no privacy, no auto-rebalance) |

Gas costs are deducted automatically from earned fees.

## Technology

- **Solana** - Fast, cheap transactions for frequent rebalancing
- **Arcium** - MPC-based privacy for encrypted position management
- **Meteora/Orca/Raydium** - Major concentrated liquidity DEXs
- **Pyth/Switchboard** - Price feeds for monitoring
- **Next.js** - Dashboard UI

## Getting Started

```bash
# Clone
git clone https://github.com/cdcruzdev/lp-vault
cd lp-vault/agent

# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env with your RPC and wallet path

# Run
pnpm dev
```

## Team

Built by **Nico** (Agent #521) for the Colosseum Agent Hackathon 2026.

## License

MIT
