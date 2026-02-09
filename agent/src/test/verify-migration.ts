/**
 * Migration Analyzer Verification Script
 * 
 * Tests the cross-pool migration analysis:
 * 1. Fetches pools from all DEXs for SOL-USDC
 * 2. Picks the worst-yielding pool as "current"
 * 3. Runs migration analysis against all alternatives
 * 4. Validates that profitable migrations have correct math
 * 
 * Run: pnpm test:migration
 */

import { Connection, PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { createDefaultRegistry } from '../dex/index.js';
import { analyzeMigration, MigrationAnalysis } from '../core/migration-analyzer.js';
import { LPAggregator } from '../core/aggregator.js';
import { getPriceOracle } from '../core/price-oracle.js';

const TOKENS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
};

async function main() {
  console.log('===========================================');
  console.log('  Poseidon - Migration Analyzer Verification');
  console.log('===========================================\n');

  const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  console.log(`RPC: ${rpcUrl}\n`);

  const connection = new Connection(rpcUrl, 'confirmed');

  // Initialize
  console.log('Initializing DEX registry...');
  const registry = createDefaultRegistry();
  await registry.initialize(connection);

  const aggregator = new LPAggregator();
  for (const adapter of registry.getAll()) {
    aggregator.registerAdapter(adapter);
  }

  // Get SOL price
  const priceOracle = getPriceOracle();
  const solPrice = await priceOracle.getPrice('SOL');
  console.log(`SOL price: $${solPrice.toFixed(2)}\n`);

  // Fetch all SOL-USDC pools
  console.log('Fetching SOL-USDC pools across all DEXs...');
  const allPools = await aggregator.findPoolsForPair(TOKENS.SOL, TOKENS.USDC);
  console.log(`Found ${allPools.length} total pools\n`);

  if (allPools.length < 2) {
    console.log('Need at least 2 pools to test migration. Exiting.');
    return;
  }

  // Show all pools
  console.log('--- All Pools ---');
  for (const pool of allPools.slice(0, 15)) {
    const tvl = pool.tvl instanceof Decimal ? pool.tvl.toNumber() : Number(pool.tvl);
    const apr = pool.apr24h instanceof Decimal ? pool.apr24h.toNumber() : Number(pool.apr24h);
    console.log(`  ${pool.dex.padEnd(8)} ${(pool.poolType || '?').padEnd(10)} TVL: $${formatNum(tvl).padEnd(10)} APR: ${apr.toFixed(2)}% ${pool.address.toBase58().slice(0, 8)}…`);
  }

  // Pick worst-yielding pool with decent TVL as "current position"
  const viablePools = allPools.filter(p => {
    const tvl = p.tvl instanceof Decimal ? p.tvl.toNumber() : Number(p.tvl);
    return tvl >= 50_000;
  });

  if (viablePools.length < 2) {
    console.log('\nNot enough viable pools (TVL >= $50k). Exiting.');
    return;
  }

  // Sort by APR ascending — worst first
  viablePools.sort((a, b) => {
    const aprA = a.apr24h instanceof Decimal ? a.apr24h.toNumber() : Number(a.apr24h);
    const aprB = b.apr24h instanceof Decimal ? b.apr24h.toNumber() : Number(b.apr24h);
    return aprA - aprB;
  });

  const currentPool = viablePools[0];
  const currentApr = currentPool.apr24h instanceof Decimal ? currentPool.apr24h.toNumber() : Number(currentPool.apr24h);
  console.log(`\n--- Simulating position in WORST pool ---`);
  console.log(`  Pool: ${currentPool.dex} ${currentPool.address.toBase58().slice(0, 8)}…`);
  console.log(`  APR: ${currentApr.toFixed(2)}%`);

  // Test with different position sizes
  const testSizes = [100, 1000, 10000];

  for (const positionValue of testSizes) {
    console.log(`\n--- Position Size: $${positionValue} ---`);
    
    const candidates = viablePools
      .filter(p => p.address.toBase58() !== currentPool.address.toBase58())
      .slice(0, 5);

    let profitableCount = 0;
    let bestAnalysis: MigrationAnalysis | null = null;

    for (const targetPool of candidates) {
      const analysis = await analyzeMigration({
        currentPool,
        targetPool,
        positionValueUSD: positionValue,
        solPriceUSD: solPrice,
      });

      const icon = analysis.profitable ? '✓' : '✗';
      console.log(`  ${icon} → ${analysis.targetDex.padEnd(8)} | Net: $${analysis.netBenefitPerDay.toFixed(4)}/day | Break-even: ${analysis.breakEvenDays === Infinity ? '∞' : analysis.breakEvenDays.toFixed(1)}d`);

      if (analysis.profitable) {
        profitableCount++;
        if (!bestAnalysis || analysis.netBenefitPerDay > bestAnalysis.netBenefitPerDay) {
          bestAnalysis = analysis;
        }
      }

      // Validate math
      if (analysis.profitable) {
        // Break-even must be < 7 days
        if (analysis.breakEvenDays >= 7) {
          console.log(`    ⚠️ VALIDATION FAIL: Break-even ${analysis.breakEvenDays}d >= 7d but marked profitable`);
        }
        // Net benefit must be > $0.50/day
        if (analysis.netBenefitPerDay <= 0.5) {
          console.log(`    ⚠️ VALIDATION FAIL: Net benefit $${analysis.netBenefitPerDay}/day <= $0.50 but marked profitable`);
        }
      }
    }

    console.log(`  → ${profitableCount}/${candidates.length} migrations profitable`);
    if (bestAnalysis) {
      console.log(`  → Best: ${bestAnalysis.targetDex} pool, $${bestAnalysis.netBenefitPerDay.toFixed(4)}/day net`);
    }
  }

  // Edge case: migrate to same pool (should never be profitable)
  console.log('\n--- Edge Case: Same Pool Migration ---');
  const samePoolAnalysis = await analyzeMigration({
    currentPool,
    targetPool: currentPool,
    positionValueUSD: 1000,
    solPriceUSD: solPrice,
  });
  const samePoolPass = !samePoolAnalysis.profitable;
  console.log(`  ${samePoolPass ? '✓' : '✗'} Same pool migration is ${samePoolAnalysis.profitable ? 'PROFITABLE (BUG!)' : 'not profitable (correct)'}`);

  console.log('\n===========================================');
  console.log('  Migration Analyzer Verification Complete');
  console.log('===========================================');
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(2);
}

main().catch(console.error);
