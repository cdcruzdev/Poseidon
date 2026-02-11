# Submission Day Gameplan -- Feb 12

**Deadline: 12:00 PM EST (noon)**

## Before Recording (30 min)

1. **Deploy to Vercel** -- `cd frontend && npx vercel login && npx vercel --prod`
   - Gives you a live demo URL for the submission
   - Build already verified (compiles clean)

2. **Start API server** -- `cd agent && pnpm run api:dev` (port 3001)
   - Pools, performance, activity, reasoning endpoints all working

3. **Start frontend** -- `cd frontend && pnpm dev` (port 3000)
   - Connect Phantom wallet, verify pools load with API running

4. **Quick test** -- Connect wallet, select SOL-USDC, see pools load, toggle auto-rebalance + privacy

## Record Videos (1-2 hours)

### Pitch Video (3 min max)
Use DEMO_VIDEO_SCRIPT.md as guide. Key beats:
- Hook: "Providing liquidity on Solana is broken"
- Problem: 3 DEXs, manual management, public positions
- Solution: One interface, auto-rebalance, privacy
- Live demo: Connect wallet, select tokens, show pools, deposit flow
- Business model: 0.1% deposit + 5% performance
- Close: "Jupiter for LP"

### Tips
- 1080p, clean browser (hide bookmarks), good mic
- Smooth mouse movements, let actions complete before moving on
- Don't rush. Don't apologize. Don't say "hackathon project"
- Show toggles (auto-rebalance, privacy) -- these are differentiators

## Submit on Colosseum

Fill in:
- **Project name:** Poseidon
- **Tagline:** Jupiter for LP
- **GitHub:** github.com/cdcruzdev/Poseidon
- **Demo video:** [YouTube unlisted link]
- **Live demo:** [Vercel URL]
- **Category:** DeFi / Infrastructure
- **Tracks:** Main + Most Agentic

Full copy-paste content in SUBMISSION.md.

## What's Already Done
- All code committed and pushed to GitHub
- README updated with full architecture
- 113+ tests passing
- All 3 DEX adapters verified on mainnet
- On-chain programs deployed to devnet
- Mobile app built and MWA working
- Frontend wired to real API data
- SUBMISSION.md and DEMO_VIDEO_SCRIPT.md ready

## Time Budget
| Task | Time |
|------|------|
| Vercel deploy | 10 min |
| Test run-through | 15 min |
| Record pitch (with retakes) | 45 min |
| Upload + submit | 15 min |
| **Total** | ~1.5 hours |

You have plenty of buffer. Don't stress it.
