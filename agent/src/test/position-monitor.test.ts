import Decimal from 'decimal.js';
import { PublicKey } from '@solana/web3.js';
import { YieldCalculator } from '../core/yield-calculator.js';
import { PositionMonitor } from '../core/position-monitor.js';
import { Position, StrategyConfig, RebalanceDecision } from '../types/index.js';

// ============================================================
// Test helpers
// ============================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// Fake pool PublicKey
const FAKE_POOL = new PublicKey('11111111111111111111111111111111');
const FAKE_OWNER = new PublicKey('11111111111111111111111111111111');

function makePosition(overrides: Partial<Position> = {}): Position {
  const base: Position = {
    id: 'test-pos-1',
    owner: FAKE_OWNER,
    dex: 'orca',
    pool: FAKE_POOL,
    liquidity: new Decimal(1000),
    lowerPrice: new Decimal(90),
    upperPrice: new Decimal(110),
    tokenAAmount: new Decimal(500),
    tokenBAmount: new Decimal(500),
    unclaimedFeesA: new Decimal(5),
    unclaimedFeesB: new Decimal(5),
    status: 'active',
    strategy: {
      autoRebalance: true,
      privacyEnabled: false,
      maxSlippageBps: 50,
      minRebalanceInterval: 300, // 5 min
    },
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    isPrivate: false,
    ...overrides,
  };
  return base;
}

// Create a PositionMonitor with minimal mocks (we only call shouldRebalance which doesn't need connection/registry for price_exit)
function makeMonitor(): PositionMonitor {
  // shouldRebalance is public and only needs position + currentPrice for the price_exit path
  // For yield_target path it calls private methods, so we test that path via the public API with a mock adapter
  const fakeRegistry = {
    get: () => ({
      getCurrentPrice: async () => new Decimal(150),
      estimateGas: async () => new Decimal(0.002),
    }),
  } as any;
  const fakeConnection = {} as any;
  const fakeWallet = {} as any;
  return new PositionMonitor(fakeConnection, fakeRegistry, fakeWallet);
}

// ============================================================
// YieldCalculator Tests
// ============================================================

section('YieldCalculator: Range calculation for target yield');
{
  const result = YieldCalculator.calculate({
    targetDailyYield: 0.4,
    currentPrice: new Decimal(150),
    volatility24h: new Decimal(0.30),
    poolFee: 30,
    volume24h: new Decimal(1_000_000),
    tvl: new Decimal(10_000_000),
  });

  assert(result.recommendedLower.lt(new Decimal(150)), 'recommendedLower < currentPrice');
  assert(result.recommendedUpper.gt(new Decimal(150)), 'recommendedUpper > currentPrice');
  assert(result.rangeWidthPercent.gt(0) && result.rangeWidthPercent.lt(100),
    'rangeWidthPercent in (0, 100)',
    `got ${result.rangeWidthPercent}`);
  // estimatedDailyYield within 50% tolerance of 0.4
  const yieldVal = result.estimatedDailyYield.toNumber();
  assert(yieldVal > 0.4 * 0.5 && yieldVal < 0.4 * 1.5,
    'estimatedDailyYield close to target (within 50%)',
    `got ${yieldVal.toFixed(4)}%`);
  assert(result.confidence >= 0 && result.confidence <= 100,
    'confidence in [0, 100]',
    `got ${result.confidence}`);
}

section('YieldCalculator: Tighter range = higher yield');
{
  const low = YieldCalculator.calculate({
    targetDailyYield: 0.1,
    currentPrice: new Decimal(150),
    volatility24h: new Decimal(0.15),
    poolFee: 30,
    volume24h: new Decimal(1_000_000),
    tvl: new Decimal(10_000_000),
  });
  const high = YieldCalculator.calculate({
    targetDailyYield: 0.5,
    currentPrice: new Decimal(150),
    volatility24h: new Decimal(0.15),
    poolFee: 30,
    volume24h: new Decimal(1_000_000),
    tvl: new Decimal(10_000_000),
  });

  assert(low.rangeWidthPercent.gt(high.rangeWidthPercent),
    '0.1% target has WIDER range than 0.5% target',
    `${low.rangeWidthPercent} vs ${high.rangeWidthPercent}`);
}

section('YieldCalculator: Edge cases');
{
  // Zero volume
  const zeroVol = YieldCalculator.calculate({
    targetDailyYield: 0.4,
    currentPrice: new Decimal(150),
    volatility24h: new Decimal(0.20),
    poolFee: 30,
    volume24h: new Decimal(0),
    tvl: new Decimal(10_000_000),
  });
  assert(zeroVol.estimatedDailyYield.lte(0.01),
    'Zero volume → yield ≈ 0',
    `got ${zeroVol.estimatedDailyYield}`);

  // Very high target
  const highTarget = YieldCalculator.calculate({
    targetDailyYield: 10,
    currentPrice: new Decimal(150),
    volatility24h: new Decimal(0.30),
    poolFee: 30,
    volume24h: new Decimal(1_000_000),
    tvl: new Decimal(10_000_000),
  });
  assert(highTarget.recommendedLower.gt(0) && highTarget.recommendedUpper.gt(highTarget.recommendedLower),
    'Very high target (10%) → still returns valid range',
    `[${highTarget.recommendedLower}, ${highTarget.recommendedUpper}]`);
}

// ============================================================
// PositionMonitor.shouldRebalance Tests
// ============================================================

section('PositionMonitor: Price exits range → should trigger rebalance');
{
  const monitor = makeMonitor();
  const pos = makePosition({
    lowerPrice: new Decimal(140),
    upperPrice: new Decimal(160),
  });
  // Price above upper bound
  const decision = await monitor.shouldRebalance(pos, new Decimal(165));
  assert(decision.shouldRebalance === true, 'shouldRebalance = true when price above range');
  assert(decision.trigger === 'price_exit', 'trigger = price_exit');

  // Price below lower bound
  const decision2 = await monitor.shouldRebalance(pos, new Decimal(135));
  assert(decision2.shouldRebalance === true, 'shouldRebalance = true when price below range');
}

section('PositionMonitor: Price still in range → should NOT rebalance');
{
  const monitor = makeMonitor();
  const pos = makePosition({
    lowerPrice: new Decimal(140),
    upperPrice: new Decimal(160),
  });
  const decision = await monitor.shouldRebalance(pos, new Decimal(150));
  assert(decision.shouldRebalance === false, 'shouldRebalance = false when price in range');
}

section('PositionMonitor: Within minimum rebalance interval → should NOT rebalance');
{
  const monitor = makeMonitor();
  const pos = makePosition({
    lowerPrice: new Decimal(140),
    upperPrice: new Decimal(160),
    lastRebalanceAt: Date.now() - 60 * 1000, // 60 seconds ago (min interval = 300s)
  });
  // Price out of range, but too soon
  const decision = await monitor.shouldRebalance(pos, new Decimal(170));
  assert(decision.shouldRebalance === false, 'shouldRebalance = false when within min interval');
  assert(decision.reason?.includes('Too soon') === true, 'reason mentions too soon');
}

section('PositionMonitor: Price exit after interval elapsed → should rebalance');
{
  const monitor = makeMonitor();
  const pos = makePosition({
    lowerPrice: new Decimal(140),
    upperPrice: new Decimal(160),
    lastRebalanceAt: Date.now() - 600 * 1000, // 10 min ago (> 5 min interval)
  });
  const decision = await monitor.shouldRebalance(pos, new Decimal(170));
  assert(decision.shouldRebalance === true, 'shouldRebalance = true after interval elapsed');
}

section('PositionMonitor: Cost-benefit check in executeRebalance (gas too expensive)');
{
  // executeRebalance is private, but the logic is: if estimatedBenefit < gasCost * 1.5, skip.
  // We test this indirectly: shouldRebalance for yield_target already checks benefit > currentYield*1.2
  // The gas check happens in executeRebalance. Let's verify the YieldCalculator.isRebalanceProfitable utility:
  
  const profitable = YieldCalculator.isRebalanceProfitable(
    new Decimal(0.1),   // current yield 0.1%
    new Decimal(0.5),   // expected 0.5%
    new Decimal(0.001), // gas 0.001 SOL
    new Decimal(10000), // $10k position
    2                   // 2 day breakeven
  );
  assert(profitable === true, 'isRebalanceProfitable = true for large improvement');

  const notProfitable = YieldCalculator.isRebalanceProfitable(
    new Decimal(0.1),    // current yield 0.1%
    new Decimal(0.1001), // tiny improvement
    new Decimal(0.5),    // expensive gas 0.5 SOL
    new Decimal(100),    // small $100 position
    2
  );
  assert(notProfitable === false, 'isRebalanceProfitable = false when gas too expensive');
}

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed! 🎉');
}
