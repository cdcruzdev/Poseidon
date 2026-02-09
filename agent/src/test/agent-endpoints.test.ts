/**
 * Quick test for agent dashboard endpoints.
 * Run: npx tsx src/test/agent-endpoints.test.ts
 */

import http from 'http';

const BASE = 'http://localhost:3001';

async function get(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode!, body: data });
        }
      });
    }).on('error', reject);
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ ${msg}`);
  }
}

async function main() {
  console.log('Testing agent endpoints (server must be running on :3001)\n');

  // 1. /api/agent/activity
  console.log('GET /api/agent/activity');
  const act = await get('/api/agent/activity');
  assert(act.body.success === true, 'success is true');
  assert(Array.isArray(act.body.data?.activities), 'activities is array');

  // 2. /api/agent/reasoning
  console.log('GET /api/agent/reasoning');
  const reason = await get('/api/agent/reasoning');
  assert(reason.body.success === true, 'success is true');
  assert(Array.isArray(reason.body.data?.decisions), 'decisions is array');

  // 3. /api/agent/performance
  console.log('GET /api/agent/performance');
  const perf = await get('/api/agent/performance');
  assert(perf.body.success === true, 'success is true');
  assert(typeof perf.body.data?.uptime === 'number', 'uptime is number');
  assert(typeof perf.body.data?.positionsMonitored === 'number', 'positionsMonitored is number');
  assert(perf.body.data?.feesCollected !== undefined, 'feesCollected exists');

  // 4. /api/positions (missing wallet)
  console.log('GET /api/positions (no wallet)');
  const noWallet = await get('/api/positions');
  assert(noWallet.body.success === false, 'fails without wallet');

  // 5. /api/positions?wallet=invalid
  console.log('GET /api/positions?wallet=invalid');
  const badWallet = await get('/api/positions?wallet=notavalidaddress');
  assert(badWallet.body.success === false, 'fails with invalid wallet');

  // 6. /api/positions?wallet=<valid> (will return empty or real data)
  const testWallet = '11111111111111111111111111111112';
  console.log(`GET /api/positions?wallet=${testWallet}`);
  const pos = await get(`/api/positions?wallet=${testWallet}`);
  assert(pos.body.success === true, 'success is true');
  assert(Array.isArray(pos.body.data?.positions), 'positions is array');

  console.log('\nDone!');
}

main().catch((e) => {
  console.error('Test error:', e.message);
  console.error('Is the server running? Start with: npx tsx src/api/server.ts');
  process.exit(1);
});
