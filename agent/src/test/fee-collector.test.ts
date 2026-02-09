import Decimal from 'decimal.js';
import { PublicKey } from '@solana/web3.js';
import { FeeCollector, FeeConfig } from '../core/fee-collector.js';

// Mock connection and wallet - we only test calculation methods
const mockConnection = {} as any;
const mockWallet = { publicKey: new PublicKey('11111111111111111111111111111111') } as any;

const defaultConfig: FeeConfig = {
  depositFeeBps: 10,        // 0.1%
  performanceFeeBps: 500,   // 5%
  treasuryAddress: new PublicKey('11111111111111111111111111111111'),
  agentGasReserveBps: 200,  // 2% of fee
};

const fc = new FeeCollector(mockConnection, mockWallet, defaultConfig);

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

function eq(a: Decimal, b: string, name: string) {
  assert(a.eq(new Decimal(b)), name, `expected ${b}, got ${a.toString()}`);
}

// ═══════════════════════════════════════════
console.log('\n📐 Deposit Fee Calculation');
// ═══════════════════════════════════════════

{
  const r = fc.calculateDepositFee(new Decimal('1'));
  eq(r.totalFee, '0.001', '1 SOL → 0.001 fee');
  eq(r.toPosition, '0.999', '1 SOL → 0.999 to position');
  eq(r.toTreasury, '0.001', '1 SOL → 0.001 to treasury');
}

{
  const r = fc.calculateDepositFee(new Decimal('100'));
  eq(r.totalFee, '0.1', '100 SOL → 0.1 fee');
}

{
  const r = fc.calculateDepositFee(new Decimal('0'));
  eq(r.totalFee, '0', '0 deposit → 0 fee');
  eq(r.toPosition, '0', '0 deposit → 0 to position');
}

{
  // 1 lamport = 0.000000001 SOL, but let's test in lamport units
  const r = fc.calculateDepositFee(new Decimal('1')); // 1 lamport
  assert(r.toPosition.gte(0), '1 lamport → non-negative position');
  assert(r.totalFee.gte(0), '1 lamport → non-negative fee');
}

// ═══════════════════════════════════════════
console.log('\n📐 Performance Fee Calculation');
// ═══════════════════════════════════════════

{
  const r = fc.calculatePerformanceFee(new Decimal('1'));
  eq(r.totalFee, '0.05', '1 SOL claimed → 0.05 total fee');
  eq(r.toUser, '0.95', '1 SOL claimed → 0.95 to user');
  // gas = 0.05 * 200/10000 = 0.001
  eq(r.toAgentGas, '0.001', '1 SOL claimed → 0.001 agent gas');
  // treasury = 0.05 - 0.001 = 0.049
  eq(r.toTreasury, '0.049', '1 SOL claimed → 0.049 treasury');
}

{
  const r = fc.calculatePerformanceFee(new Decimal('0'));
  eq(r.totalFee, '0', '0 claimed → 0 fee');
  eq(r.toUser, '0', '0 claimed → 0 to user');
  eq(r.toTreasury, '0', '0 claimed → 0 treasury');
  eq(r.toAgentGas, '0', '0 claimed → 0 gas');
}

{
  const r = fc.calculatePerformanceFee(new Decimal('1000'));
  eq(r.totalFee, '50', '1000 SOL → 50 fee');
  eq(r.toUser, '950', '1000 SOL → 950 to user');
  eq(r.toTreasury, '49', '1000 SOL → 49 treasury');
  eq(r.toAgentGas, '1', '1000 SOL → 1 gas');
}

{
  // Conservation: toUser + toTreasury + toAgentGas = claimedFees
  for (const amt of ['1', '0.123456789', '999999.999', '0.000001']) {
    const d = new Decimal(amt);
    const r = fc.calculatePerformanceFee(d);
    const sum = r.toUser.add(r.toTreasury).add(r.toAgentGas);
    assert(sum.eq(d), `Conservation: ${amt} → sum=${sum.toString()}`);
  }
}

// ═══════════════════════════════════════════
console.log('\n📐 Edge Cases');
// ═══════════════════════════════════════════

{
  // Sub-lamport precision
  const tiny = new Decimal('0.000000001');
  const r = fc.calculateDepositFee(tiny);
  assert(r.toPosition.gte(0), 'Sub-lamport deposit → non-negative');
  assert(r.toPosition.add(r.totalFee).eq(tiny), 'Sub-lamport deposit → conservation');
}

{
  // Very large
  const huge = new Decimal('1000000000');
  const r = fc.calculateDepositFee(huge);
  eq(r.totalFee, '1000000', 'Billion deposit → 1M fee');
  assert(r.toPosition.add(r.totalFee).eq(huge), 'Billion deposit → conservation');
}

{
  const huge = new Decimal('1000000000');
  const r = fc.calculatePerformanceFee(huge);
  const sum = r.toUser.add(r.toTreasury).add(r.toAgentGas);
  assert(sum.eq(huge), 'Billion perf fee → conservation');
}

// ═══════════════════════════════════════════
console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(40));
process.exit(failed > 0 ? 1 : 0);
