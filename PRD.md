# Poseidon v2 - Product Requirements Document

**Project:** Poseidon - Private LP Aggregator
**Deadline:** February 12, 2026 (Colosseum Agent Hackathon)
**Prize Pool:** $100k ($50k first place)

---

## Vision

"Jupiter for LP" - One interface to deposit liquidity across all Solana DEXs. User picks tokens, we find the best pool. Simple as that.

---

## Core UX Philosophy

**KISS (Keep It Simple, Stupid)**
- No pool browsing pages
- No analysis paralysis
- User enters tokens + amount, we do the rest
- Jupiter-style vertical flow

---

## Key Requirements

### 1. Wallet Integration (CRITICAL)

**Use Solana Mobile Wallet Adapter** for Solana Seeker compatibility.

Reference: AllDomains repo `contexts/ClientWalletProvider.tsx`

Required packages:
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-react-ui`
- `@solana/wallet-adapter-wallets`
- `@solana-mobile/wallet-adapter-mobile`

Support wallets:
- Phantom (priority)
- Solflare
- Mobile wallets via Solana Mobile Adapter

### 2. Design System Overhaul

**Problem:** Current teal/purple looks like generic AI site

**New Direction:**
- **Color Palette:** AVOID cyan, teal, purple, pink gradients
  - Suggestion: Deep navy (#0D1B2A), Gold/Amber accent (#F59E0B), Clean whites
  - OR: Dark charcoal (#1A1A2E), Coral accent (#E94560), Cream text
  - OR: Midnight blue (#16213E), Electric lime (#C5F82A), Off-white
  
- **Typography:** 
  - Headers: Bold geometric sans (e.g., Satoshi, General Sans, Clash Display)
  - Body: Clean readable sans (Inter, DM Sans)
  - Monospace for numbers: JetBrains Mono or IBM Plex Mono

- **Logo:** NOT stacked diamonds
  - Options: Trident (Poseidon god reference), Wave, Droplet
  - Simple, memorable, works at small sizes

### 3. Homepage - Jupiter-Style Vertical Flow

**Reference:** https://jup.ag

**Layout (top to bottom):**

```
+------------------------------------------+
|  NAVBAR (Logo | Nav | Connect Wallet)    |
+------------------------------------------+
|                                          |
|  HERO SECTION (brief)                    |
|  "One Click LP. Best Yields. Private."   |
|                                          |
+------------------------------------------+
|                                          |
|  MAIN SWAP-STYLE CARD                    |
|  +------------------------------------+  |
|  | Token A: [SOL     v] [Amount    ]  |  |
|  |                                    |  |
|  |        [SWAP ICON / DIVIDER]       |  |
|  |                                    |  |
|  | Token B: [USDC    v] [Amount    ]  |  |
|  +------------------------------------+  |
|  |                                    |  |
|  | BEST POOL FOUND:                   |  |
|  | Meteora DLMM | 24h: 0.15% | $5.2M  |  |
|  |                                    |  |
|  | [v] Alternatives (3)               |  |
|  |   - Orca | 24h: 0.12% | $32M      |  |
|  |   - Raydium | 24h: 0.08% | $1.1M  |  |
|  +------------------------------------+  |
|  |                                    |  |
|  | [ ] Enable Auto-Rebalancing        |  |
|  |     Target 24h Yield: [0.10%  v]   |  |
|  |     (Our fee: 10% of yield)        |  |
|  +------------------------------------+  |
|  |                                    |  |
|  |  [    DEPOSIT LIQUIDITY    ]       |  |
|  |                                    |  |
|  +------------------------------------+  |
|                                          |
+------------------------------------------+
|  MY POSITIONS (if connected)             |
|  - SOL/USDC @ Meteora | $1,234 | +2.3%  |
|  - JUP/USDC @ Orca | $567 | +0.8%       |
+------------------------------------------+
|  FOOTER                                  |
+------------------------------------------+
```

### 4. Pool Selection Logic

**User flow:**
1. User selects Token A and Token B
2. Backend queries all DEXs in parallel
3. Returns BEST pool based on:
   - Liquidity (higher = better, less slippage)
   - Fee tier (lower = better for small LPs)
   - 24h volume/TVL ratio (higher = more fees earned)
4. Show alternatives in collapsed accordion
5. User can override selection if they want

**"Best Pool" algorithm:**
```
score = (volume_24h / tvl) * 100 - fee_penalty + liquidity_bonus
```

### 5. Auto-Rebalancing (Revenue Model)

When enabled:
- User sets target 24h yield floor (e.g., 0.10%)
- We monitor position
- If price moves out of range OR yield drops below target:
  - Rebalance to optimal range
  - Our fee: 10% of yield generated
- Longer they stay = more revenue for us

UI:
- Checkbox to enable
- Dropdown for target yield: 0.05%, 0.10%, 0.15%, 0.20%, 0.25%
- Tooltip explaining the fee structure

### 6. Pages Structure

**KEEP:**
- `/` - Homepage with Jupiter-style deposit flow
- `/positions` - My active positions (if wallet connected)

**REMOVE:**
- `/pools` - DELETE THIS PAGE (analysis paralysis)
- `/vault` - Not needed

---

## Technical Implementation

### Sub-Agent Tasks

1. **design-system** - New colors, typography, logo
2. **wallet-adapter** - Solana Mobile Wallet Adapter integration  
3. **homepage-redesign** - Jupiter-style vertical flow
4. **pool-optimizer** - Best pool selection algorithm
5. **positions-page** - Clean positions management

### File Structure
```
frontend/
  src/
    app/
      page.tsx         # Homepage with deposit flow
      positions/
        page.tsx       # My positions
      layout.tsx
      globals.css
    components/
      DepositCard.tsx     # Main deposit interface
      TokenSelector.tsx   # Token dropdown
      PoolResult.tsx      # Best pool display
      Alternatives.tsx    # Accordion with alternatives
      AutoRebalance.tsx   # Rebalancing toggle
      PositionCard.tsx    # Position display
      Navbar.tsx
      Footer.tsx
    lib/
      api.ts              # Backend calls
      tokens.ts           # Token list
      wallet.ts           # Wallet helpers
    styles/
      design-system.css   # Colors, typography
```

---

## Success Criteria

1. User can deposit in under 30 seconds
2. No page navigation required for core flow
3. Mobile-friendly (Solana Seeker ready)
4. Clean, professional aesthetic (NOT generic AI look)
5. Demo video shows smooth UX

---

## Timeline

- **Tonight:** Design system + wallet adapter + homepage structure
- **Tomorrow:** Wire up deposit flow + positions
- **Day 3-4:** Polish + auto-rebalancing
- **Day 5:** Demo video + submission

---

*Created: 2026-02-04 22:00 EST*
