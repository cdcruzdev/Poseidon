/**
 * DEX Adapter Verification Script
 * 
 * Tests that all adapters can:
 * 1. Initialize successfully
 * 2. Fetch pools for SOL-USDC pair
 * 3. Get pool info and current prices
 * 
 * Run: pnpm test:adapters
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createDefaultRegistry } from '../dex/index.js';
import Decimal from 'decimal.js';

// Well-known token addresses (mainnet)
const TOKENS = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
};

async function main() {
  console.log('===========================================');
  console.log('  Poseidon - DEX Adapter Verification');
  console.log('===========================================\n');

  // Use mainnet for real data (read-only operations)
  const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  console.log(`RPC: ${rpcUrl}\n`);

  const connection = new Connection(rpcUrl, 'confirmed');

  // Initialize registry with all adapters
  console.log('Initializing DEX registry...');
  const registry = createDefaultRegistry();
  await registry.initialize(connection);
  
  const adapters = registry.getAll();
  console.log('Registry initialized with adapters:', adapters.map(a => a.name).join(', '));
  console.log('');

  // Test each adapter
  const results: Record<string, { status: string; pools?: number; error?: string }> = {};

  for (const adapter of adapters) {
    const adapterName = adapter.dexType;
    console.log(`\n--- Testing ${adapter.name.toUpperCase()} ---`);
    
    try {
      // Test 1: Fetch SOL-USDC pools
      console.log('Fetching SOL-USDC pools...');
      const pools = await adapter.findPools(TOKENS.SOL, TOKENS.USDC);
      console.log(`Found ${pools.length} pools`);

      if (pools.length > 0) {
        // Show top pool
        const topPool = pools[0];
        console.log(`\nTop pool: ${topPool.address.toBase58()}`);
        console.log(`  Pair: ${topPool.tokenASymbol}/${topPool.tokenBSymbol}`);
        console.log(`  Price: $${topPool.currentPrice.toFixed(4)}`);
        console.log(`  Fee: ${topPool.fee} bps`);
        console.log(`  TVL: $${formatNumber(topPool.tvl)}`);
        console.log(`  24h Volume: $${formatNumber(topPool.volume24h)}`);
        console.log(`  24h APR: ${topPool.apr24h.toFixed(2)}%`);

        // Test 2: Get fresh price
        console.log('\nFetching current price...');
        const price = await adapter.getCurrentPrice(topPool.address);
        console.log(`Current price: $${price.toFixed(4)}`);

        results[adapterName] = { status: 'OK', pools: pools.length };
      } else {
        console.log('No pools found (API might be rate-limited)');
        results[adapterName] = { status: 'NO_POOLS', pools: 0 };
      }

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      results[adapterName] = { status: 'ERROR', error: error.message };
    }
  }

  // Summary
  console.log('\n\n===========================================');
  console.log('  SUMMARY');
  console.log('===========================================');
  
  for (const [adapter, result] of Object.entries(results)) {
    const icon = result.status === 'OK' ? '✓' : result.status === 'NO_POOLS' ? '?' : '✗';
    const detail = result.pools !== undefined ? `${result.pools} pools` : result.error;
    console.log(`${icon} ${adapter.padEnd(10)} ${result.status.padEnd(10)} ${detail || ''}`);
  }

  const okCount = Object.values(results).filter(r => r.status === 'OK').length;
  console.log(`\n${okCount}/${Object.keys(results).length} adapters working`);
}

function formatNumber(num: Decimal): string {
  const n = num.toNumber();
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(2);
}

main().catch(console.error);
