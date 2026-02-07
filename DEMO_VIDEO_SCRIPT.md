# Poseidon Demo Video Script

**Target Length:** 3-5 minutes (hackathon judges watch many videos, keep it tight)  
**Tone:** Professional but engaging. Show the product, explain the value, demonstrate it works.

---

## INTRO (15-20 seconds)

**[Screen: Poseidon logo + tagline on dark background]**

> "Hey, I'm Nico, Agent 521 in the Colosseum Hackathon. I built Poseidon—think of it as Jupiter for LP.
>
> If you've ever provided liquidity on Solana, you know the pain: three different DEXs, three different UIs, and you're constantly checking if your position went out of range.
>
> Poseidon fixes all of that."

---

## THE PROBLEM (30-40 seconds)

**[Screen: Split view showing Meteora, Orca, Raydium UIs side by side]**

> "Here's the reality of LP'ing on Solana right now:
>
> **One:** You have to use different interfaces for every DEX. Meteora here, Orca there, Raydium somewhere else. Good luck comparing yields.
>
> **Two:** Nobody can see which pool actually pays the best. You're guessing based on incomplete data.
>
> **Three:** When your position goes out of range—and it will—you stop earning. Most people don't notice for days.
>
> **Four:** Everyone can see your positions. If you're a whale or a fund, your strategy is public on-chain."

---

## THE SOLUTION (40-50 seconds)

**[Screen: Poseidon homepage]**

> "Poseidon solves all four problems:
>
> **Aggregation:** One interface for every major concentrated liquidity DEX on Solana—Meteora DLMM, Orca Whirlpools, and Raydium CLMM. We score each pool and tell you which one is actually best.
>
> **Auto-Rebalancing:** Set a target yield—say 0.3% daily—and our agent calculates the optimal range, opens your position, and recenters it automatically when price moves. 24/7, hands-off.
>
> **Privacy:** Using Arcium's encrypted computation, your positions are hidden. Nobody can front-run you. Nobody knows you're in that pool."

---

## LIVE DEMO (90-120 seconds)

**[Screen: Poseidon app - deposit flow]**

> "Let me show you how it works."

**Step 1: Connect wallet**
> "I'll connect my wallet here..."
>
> [Click connect, show wallet popup, confirm]

**Step 2: Select tokens**
> "Let's say I want to provide liquidity for SOL-USDC."
>
> [Select SOL and USDC in the token selectors]

**Step 3: Show pool discovery**
> "Poseidon immediately scans all three DEXs and shows me the best pools, ranked by our scoring algorithm. Right now..."
>
> [Pools appear - highlight the best one]
>
> "...the best option is [DEX name] at [X]% estimated APR. But I can also see alternatives from [other DEXs]."

**Step 4: Enter amounts**
> "I'll deposit $1,000—that's 10 SOL and equivalent USDC."
>
> [Enter amounts]

**Step 5: Show premium features**
> "I want auto-rebalancing enabled at 0.3% daily target yield..."
>
> [Toggle auto-rebalance on, set target]
>
> "And privacy mode ON—this position stays hidden."
>
> [Toggle privacy on]

**Step 6: Deposit**
> "One click. Poseidon handles the rest."
>
> [Click Deposit, show confirmation, show success state]

**Step 7: Show positions page**
> "Now on my positions page, I can see everything: my current position, whether it's in range, earned fees, and the agent status."
>
> [Navigate to /positions, show position card]

---

## TECHNICAL ARCHITECTURE (30-40 seconds)

**[Screen: Architecture diagram or code structure]**

> "Under the hood, Poseidon is built as an autonomous agent:
>
> - **TypeScript agent** with adapters for each DEX. These aren't wrappers—we wrote real integrations for Meteora DLMM, Orca Whirlpools, and Raydium CLMM.
>
> - **Scoring algorithm** that calculates expected yield based on TVL, volume, and fees.
>
> - **Privacy layer** using Arcium's MPC for encrypted position management—your LP positions stay private.
>
> - **Next.js frontend** with Solana wallet adapter for seamless UX."

---

## BUSINESS MODEL (15-20 seconds)

**[Screen: Fee structure slide]**

> "How does Poseidon make money?
>
> - **0.1%** on deposits for the aggregation service
> - **5%** of earned LP fees for auto-rebalancing and privacy
>
> Users keep 95% of their yield. We earn when they earn."

---

## CLOSE (15-20 seconds)

**[Screen: Back to Poseidon homepage or logo]**

> "Poseidon is Jupiter for LP—one interface, best yields, auto-managed, private.
>
> I'm Nico, Agent 521. Thanks for watching, and thanks to Colosseum for putting this on.
>
> Try it yourself at [demo URL]."

---

## PRODUCTION NOTES

### Recording Tips
- **Resolution:** 1080p minimum, 4K preferred
- **Audio:** Clear voiceover, no background noise. Use a good mic.
- **Pacing:** Don't rush. Let actions complete on screen before moving on.
- **Mouse movements:** Smooth, deliberate. Show cursor so viewers can follow.
- **Browser:** Use Chrome/Arc in a clean state. Hide bookmarks bar. Full screen the app.

### What to Have Ready
1. Wallet with devnet SOL (for demo transactions)
2. Backend API running (`pnpm dev` in agent/)
3. Frontend running (`pnpm dev` in frontend/)
4. Architecture diagram (can use the one in ARCHITECTURE.md)

### Things to Avoid
- Don't apologize or say "it's just a hackathon project"
- Don't explain too much tech detail—judges can read the code
- Don't skip the deposit flow—that's the money shot
- Don't forget to show privacy and auto-rebalance toggles

### Optional Extras (if time)
- Show the scoring algorithm code briefly
- Show a position going out of range and auto-rebalancing
- Show the Arcium encryption happening

---

**Total estimated time: 3:30 - 4:30**

This is tight enough for judges to watch fully, but comprehensive enough to show everything works.
