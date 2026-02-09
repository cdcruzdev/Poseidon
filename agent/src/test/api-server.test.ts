/**
 * Integration tests for Poseidon API Server
 * Run: npx tsx src/test/api-server.test.ts
 */

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;
const results: string[] = [];

function log(name: string, ok: boolean, detail?: string) {
  const status = ok ? '✅ PASS' : '❌ FAIL';
  const msg = `${status} | ${name}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
  results.push(msg);
  ok ? passed++ : failed++;
}

async function fetchJson(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json();
  return { status: res.status, body };
}

async function waitForServer(maxMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function runTests() {
  console.log('⏳ Waiting for server on port 3001...');
  const up = await waitForServer();
  if (!up) {
    console.log('❌ Server did not start within 60s');
    process.exit(1);
  }
  console.log('🟢 Server is up!\n');

  // 1. Health
  try {
    const { status, body } = await fetchJson('/health');
    log('GET /health - status 200', status === 200);
    log('GET /health - success true', body.success === true);
    log('GET /health - data.status ok', body.data?.status === 'ok');
  } catch (e: any) {
    log('GET /health', false, e.message);
  }

  // 2. Pools
  try {
    const { status, body } = await fetchJson('/api/pools?tokenA=SOL&tokenB=USDC');
    log('GET /api/pools - status 200', status === 200);
    log('GET /api/pools - success true', body.success === true);
    const pools = body.data;
    log('GET /api/pools - data is array', Array.isArray(pools));
    log('GET /api/pools - has pools', Array.isArray(pools) && pools.length > 0, `count: ${pools?.length}`);
    if (Array.isArray(pools) && pools.length > 0) {
      const p = pools[0];
      log('GET /api/pools - pool has address', typeof p.address === 'string');
      log('GET /api/pools - pool has dex', typeof p.dex === 'string');
      log('GET /api/pools - pool has tvl', typeof p.tvl === 'number');
      log('GET /api/pools - pool has volume24h', typeof p.volume24h === 'number');
      log('GET /api/pools - pool has feeRate', typeof p.feeRate === 'number');
      log('GET /api/pools - pool has currentPrice', typeof p.currentPrice === 'number');
      const dexes = new Set(pools.map((x: any) => x.dex));
      log('GET /api/pools - multiple DEXes', dexes.size >= 2, `dexes: ${[...dexes].join(', ')}`);
    }
  } catch (e: any) {
    log('GET /api/pools', false, e.message);
  }

  // 3. Compare
  try {
    const { status, body } = await fetchJson('/api/compare?tokenA=SOL&tokenB=USDC');
    log('GET /api/compare - status 200', status === 200);
    log('GET /api/compare - success true', body.success === true);
    const d = body.data;
    log('GET /api/compare - pools array', Array.isArray(d?.pools) && d.pools.length > 0, `count: ${d?.pools?.length}`);
    log('GET /api/compare - recommendation exists', !!d?.recommendation);
    log('GET /api/compare - recommendation.dex', typeof d?.recommendation?.dex === 'string');
    log('GET /api/compare - recommendation.estimatedApr', typeof d?.recommendation?.estimatedApr === 'number');
    // Check sorted by APR descending
    if (Array.isArray(d?.pools) && d.pools.length > 1) {
      const aprs = d.pools.map((p: any) => p.estimatedApr);
      const sorted = aprs.every((v: number, i: number) => i === 0 || aprs[i - 1] >= v);
      log('GET /api/compare - pools sorted by APR desc', sorted);
    }
  } catch (e: any) {
    log('GET /api/compare', false, e.message);
  }

  // 4. Best pool
  try {
    const { status, body } = await fetchJson('/api/best-pool?tokenA=SOL&tokenB=USDC');
    log('GET /api/best-pool - status 200', status === 200);
    log('GET /api/best-pool - success true', body.success === true);
    const d = body.data;
    log('GET /api/best-pool - bestPool exists', !!d?.bestPool);
    log('GET /api/best-pool - bestPool.score > 0', d?.bestPool?.score > 0, `score: ${d?.bestPool?.score}`);
    log('GET /api/best-pool - alternatives is array', Array.isArray(d?.alternatives));
  } catch (e: any) {
    log('GET /api/best-pool', false, e.message);
  }

  // 5. Price
  try {
    const { status, body } = await fetchJson('/api/price?symbol=SOL');
    log('GET /api/price - status 200', status === 200);
    log('GET /api/price - success true', body.success === true);
    log('GET /api/price - price > 0', body.data?.price > 0, `price: ${body.data?.price}`);
  } catch (e: any) {
    log('GET /api/price', false, e.message);
  }

  // 6. Prices
  try {
    const { status, body } = await fetchJson('/api/prices?symbols=SOL,USDC');
    log('GET /api/prices - status 200', status === 200);
    log('GET /api/prices - success true', body.success === true);
    log('GET /api/prices - has SOL', body.data?.SOL > 0, `SOL: ${body.data?.SOL}`);
    log('GET /api/prices - has USDC', body.data?.USDC > 0, `USDC: ${body.data?.USDC}`);
  } catch (e: any) {
    log('GET /api/prices', false, e.message);
  }

  // 7. Error cases
  try {
    const r1 = await fetchJson('/api/pools');
    log('GET /api/pools no params - 400', r1.status === 400);
    log('GET /api/pools no params - error msg', !!r1.body?.error);
  } catch (e: any) {
    log('GET /api/pools no params', false, e.message);
  }

  try {
    const r2 = await fetchJson('/api/pools?tokenA=INVALIDXYZ&tokenB=SOL');
    log('GET /api/pools invalid token - 400', r2.status === 400);
  } catch (e: any) {
    log('GET /api/pools invalid token', false, e.message);
  }

  try {
    const r3 = await fetchJson('/nonexistent');
    log('GET /nonexistent - 404', r3.status === 404);
  } catch (e: any) {
    log('GET /nonexistent', false, e.message);
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
