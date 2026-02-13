/**
 * AI Reasoner Test
 * 
 * Tests the Kimi K2.5 integration via NVIDIA NIM.
 * Run: npx tsx src/test/ai-reasoner.test.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import Decimal from 'decimal.js';
import { AIReasoner, MarketContext } from '../core/ai-reasoner.js';

async function testAIReasoner() {
  console.log('\n=== AI Reasoner Test ===\n');

  const reasoner = new AIReasoner();

  if (!reasoner.isConfigured) {
    console.error('NVIDIA_API_KEY not set in .env -- cannot test AI reasoner');
    process.exit(1);
  }

  console.log('API key found. Testing Kimi K2.5 via NVIDIA NIM...\n');

  // Scenario 1: Price exited range, low volatility -- should rebalance
  console.log('--- Scenario 1: Price exited range, calm market ---');
  const decision1 = await reasoner.analyzeRebalance(
    {
      id: 'test-pos-1',
      dex: 'meteora',
      pool: { toBase58: () => 'FakePoolAddress111' } as any,
      lowerPrice: new Decimal(95),
      upperPrice: new Decimal(105),
      strategy: { autoRebalance: true, minRebalanceInterval: 300, targetDailyYield: 0.1 },
    } as any,
    {
      currentPrice: new Decimal(108),
      priceChange1h: 1.2,
      priceChange24h: 3.5,
      volatility24h: 4,
      poolTvl: new Decimal(2000000),
      poolVolume24h: new Decimal(800000),
      poolFeeRate: 30,
      currentYield24h: 0,
      gasEstimateSol: 0.002,
      positionValueUsd: 5000,
    },
    'price_exit'
  );
  console.log(`Action: ${decision1.action}`);
  console.log(`Confidence: ${(decision1.confidence * 100).toFixed(0)}%`);
  console.log(`Reasoning: ${decision1.reasoning}\n`);

  // Scenario 2: Price spiked hard, high volatility -- should wait
  console.log('--- Scenario 2: Volatile spike, price just crashed ---');
  const decision2 = await reasoner.analyzeRebalance(
    {
      id: 'test-pos-2',
      dex: 'orca',
      pool: { toBase58: () => 'FakePoolAddress222' } as any,
      lowerPrice: new Decimal(140),
      upperPrice: new Decimal(160),
      strategy: { autoRebalance: true, minRebalanceInterval: 300 },
    } as any,
    {
      currentPrice: new Decimal(125),
      priceChange1h: -8.5,
      priceChange24h: -15.2,
      volatility24h: 22,
      poolTvl: new Decimal(500000),
      poolVolume24h: new Decimal(1200000),
      poolFeeRate: 100,
      currentYield24h: 0,
      gasEstimateSol: 0.003,
      positionValueUsd: 200,
    },
    'price_exit'
  );
  console.log(`Action: ${decision2.action}`);
  console.log(`Confidence: ${(decision2.confidence * 100).toFixed(0)}%`);
  console.log(`Reasoning: ${decision2.reasoning}\n`);

  // Scenario 3: Small position, gas costs relatively high
  console.log('--- Scenario 3: Tiny position, gas costs eat into value ---');
  const decision3 = await reasoner.analyzeRebalance(
    {
      id: 'test-pos-3',
      dex: 'raydium',
      pool: { toBase58: () => 'FakePoolAddress333' } as any,
      lowerPrice: new Decimal(0.0009),
      upperPrice: new Decimal(0.0011),
      strategy: { autoRebalance: true, minRebalanceInterval: 300 },
    } as any,
    {
      currentPrice: new Decimal(0.00115),
      priceChange1h: 2.0,
      priceChange24h: 5.0,
      volatility24h: 8,
      poolTvl: new Decimal(150000),
      poolVolume24h: new Decimal(50000),
      poolFeeRate: 50,
      currentYield24h: 0.02,
      gasEstimateSol: 0.002,
      positionValueUsd: 15,
    },
    'price_exit'
  );
  console.log(`Action: ${decision3.action}`);
  console.log(`Confidence: ${(decision3.confidence * 100).toFixed(0)}%`);
  console.log(`Reasoning: ${decision3.reasoning}\n`);

  console.log('=== All tests complete ===\n');
}

testAIReasoner().catch(console.error);
