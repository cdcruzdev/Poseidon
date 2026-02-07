# Private LP Vault - Architecture

## Vision
"Jupiter for LP" - A DEX aggregator for liquidity provision with:
- **Position Privacy**: Hide your LP positions from public view via Arcium
- **Auto-Rebalancing**: Agent maintains optimal ranges based on price or yield targets
- **Multi-DEX**: Orca, Raydium, Meteora from day one

## User Flow

```
1. User connects wallet
2. Selects token pair (e.g., BONK-SOL)
3. Chooses strategy:
   a) Manual range (traditional)
   b) Target daily yield (e.g., 0.4%) - agent calculates optimal range
   c) Auto-optimize (maximize yield within risk tolerance)
4. Toggles:
   - [x] Privacy mode (default ON) - positions hidden via Arcium
   - [x] Auto-rebalance (default ON) - agent manages ranges
5. Deposits funds
6. Agent deploys to optimal DEX and manages position
```

## Core Components

### 1. LP Aggregator Engine
- Fetches pool data from Orca, Raydium, Meteora
- Calculates optimal DEX for given pair + strategy
- Compares: fees, TVL, volume, current APY, tick spacing

### 2. Yield Calculator
- Given target daily yield %, calculates required range width
- Tighter range = higher fees but more rebalancing
- Factors in: historical volatility, gas costs, rebalance frequency

### 3. Position Manager (Agent Core)
- Monitors positions continuously
- Triggers rebalance when:
  - Price exits range (immediate)
  - Yield drops below target (threshold check)
  - Time-based check (backup)
- Only rebalances if: expected_benefit > gas_cost * 1.5

### 4. Privacy Layer (Arcium Integration)
- Deposits routed through encrypted vault
- Position details stored as encrypted state
- Only owner can decrypt via threshold signature
- On-chain: observers see vault activity, not user positions

### 5. Fee Module
- Deposit fee: 0.1% of position value
- Performance fee: 5% of earned fees
- Gas: Deducted from earned fees automatically

## Technical Stack

### Smart Contracts (Anchor/Rust)
- `vault.rs` - Main vault program
- `position.rs` - Position management
- `aggregator.rs` - DEX routing logic

### Arcium Integration (Arcis/Rust)
- `confidential_deposit.rs` - Encrypted deposits
- `confidential_state.rs` - Hidden position state
- `reveal.rs` - Owner-only position viewing

### Agent (TypeScript)
- Price monitoring (Pyth/Switchboard)
- Rebalance logic
- DEX SDK integrations (Orca, Raydium, Meteora)

### Frontend (Next.js)
- Dashboard showing (decrypted) positions
- Strategy configuration
- Performance analytics

## DEX Integration Priority

1. **Meteora DLMM** - Dynamic fees, concentrated liquidity
2. **Orca Whirlpools** - Most popular, good SDK
3. **Raydium CLMM** - Concentrated liquidity pools

## MVP Scope (Hackathon)

### Must Have
- [ ] Single token pair support
- [ ] Meteora integration (Chris's pain point)
- [ ] Price-based rebalancing
- [ ] Basic Arcium privacy (encrypted deposits)
- [ ] Agent autonomous operation

### Should Have
- [ ] Multi-DEX routing
- [ ] Target yield % strategy
- [ ] Frontend dashboard

### Nice to Have
- [ ] Orca + Raydium integration
- [ ] Shared vault (anonymity set)
- [ ] Historical analytics

## Revenue Projections

Assuming 1000 users, avg $5k position:
- Total TVL: $5M
- Deposit fees (0.1%): $5,000 one-time
- Performance fees (5% of ~20% APY): $50,000/year
- Monthly revenue at scale: ~$4,200

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Arcium testnet instability | Build with fallback to non-private mode |
| DEX SDK changes | Abstract DEX layer, easy to swap |
| Gas spikes | Smart rebalance thresholds |
| Impermanent loss | Clear user education, not our problem to solve |

## File Structure

```
lp-vault/
├── programs/           # Anchor programs
│   ├── vault/
│   └── aggregator/
├── arcium/            # Arcis confidential instructions
│   ├── deposit/
│   └── state/
├── agent/             # TypeScript agent
│   ├── src/
│   │   ├── monitor.ts
│   │   ├── rebalance.ts
│   │   └── dex/
│   │       ├── meteora.ts
│   │       ├── orca.ts
│   │       └── raydium.ts
├── app/               # Next.js frontend
└── tests/
```

## Timeline (8 days)

| Day | Focus |
|-----|-------|
| 1 | Architecture, DEX SDK research, Arcium setup |
| 2-3 | Core vault program + Meteora integration |
| 4 | Arcium privacy layer |
| 5-6 | Agent logic + rebalancing |
| 7 | Frontend dashboard |
| 8 | Testing, polish, submission |
