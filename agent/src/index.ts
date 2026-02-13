import { Connection, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { createDefaultRegistry, DexRegistry } from './dex/index.js';
import { LPAggregator } from './core/aggregator.js';
import { PositionMonitor } from './core/position-monitor.js';
import { AgentConfig } from './types/index.js';
import { AgentWallet } from './wallet/agent-wallet.js';
import { FeeCollector } from './core/fee-collector.js';

dotenv.config();

/**
 * Private LP Vault Agent
 * 
 * An autonomous agent that:
 * 1. Aggregates LP opportunities across DEXs (Meteora, Orca, Raydium)
 * 2. Manages positions with privacy via Arcium
 * 3. Auto-rebalances based on price or yield targets
 * 
 * "Jupiter for LP" with privacy and intelligence.
 */

async function main() {
  console.log('========================================');
  console.log('  Private LP Vault Agent');
  console.log('  Colosseum Agent Hackathon 2026');
  console.log('========================================');
  console.log('');

  // Load configuration
  const config: AgentConfig = {
    rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.WS_URL,
    walletPath: process.env.WALLET_PATH || './wallet.json',
    priceCheckIntervalMs: parseInt(process.env.PRICE_CHECK_INTERVAL_MS || '60000'),
    arciumEnabled: process.env.ARCIUM_ENABLED === 'true',
    arciumCluster: process.env.ARCIUM_CLUSTER,
    depositFeeBps: parseInt(process.env.DEPOSIT_FEE_BPS || '10'), // 0.1%
    performanceFeeBps: parseInt(process.env.PERFORMANCE_FEE_BPS || '500'), // 5%
  };

  console.log('Configuration:');
  console.log(`  RPC: ${config.rpcUrl}`);
  console.log(`  Price check interval: ${config.priceCheckIntervalMs}ms`);
  console.log(`  Arcium privacy: ${config.arciumEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Deposit fee: ${config.depositFeeBps / 100}%`);
  console.log(`  Performance fee: ${config.performanceFeeBps / 100}%`);
  console.log('');

  // Initialize connection
  const connection = new Connection(config.rpcUrl, {
    commitment: 'confirmed',
    wsEndpoint: config.wsUrl,
  });

  // Load wallet — prefer AgentWallet (server-side signing), fall back to local keypair
  let wallet: AgentWallet | Keypair;
  if (process.env.AGENTWALLET_USERNAME && process.env.AGENTWALLET_API_TOKEN) {
    wallet = AgentWallet.fromEnv();
    console.log(`AgentWallet connected: ${wallet.publicKey.toBase58()}`);
    console.log(`  Username: ${process.env.AGENTWALLET_USERNAME}`);
    console.log('  Signing: server-side via mcpay.tech');
  } else {
    // Fallback to local keypair (dev/testing only)
    try {
      const walletData = fs.readFileSync(config.walletPath, 'utf-8');
      const secretKey = JSON.parse(walletData);
      wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
      console.log(`Local wallet loaded: ${wallet.publicKey.toBase58()}`);
      console.log('  WARNING: Local keypairs are not recommended for production.');
    } catch (error) {
      console.error('No AgentWallet configured and no local wallet found.');
      console.error('Set AGENTWALLET_USERNAME + AGENTWALLET_API_TOKEN + AGENTWALLET_SOLANA_ADDRESS');
      process.exit(1);
    }
  }

  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);
  console.log('');

  // Initialize fee collector
  const feeCollector = FeeCollector.fromEnv(connection, wallet);
  const feeStats = feeCollector.getStats();
  console.log(`Fee routing:`);
  console.log(`  Deposit fee: ${feeStats.config.depositFeeBps / 100}%`);
  console.log(`  Performance fee: ${feeStats.config.performanceFeeBps / 100}%`);
  console.log(`  Gas reserve: ${feeStats.config.agentGasReserveBps / 100}% of perf fee`);
  console.log(`  Treasury: ${feeStats.config.treasuryAddress}`);
  console.log('');

  // Initialize DEX registry with all supported DEXs
  const registry = createDefaultRegistry();
  await registry.initialize(connection);

  // Initialize aggregator
  const aggregator = new LPAggregator();
  // Register adapters from registry
  for (const adapter of registry.getAll()) {
    aggregator.registerAdapter(adapter);
  }

  // Initialize position monitor with fee collector
  const monitor = new PositionMonitor(
    connection,
    registry,
    wallet,
    config.priceCheckIntervalMs,
    feeCollector
  );

  // Handle shutdown gracefully
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    monitor.stop();
    process.exit(0);
  });

  // Start monitoring
  console.log('Starting position monitor...');
  console.log('Press Ctrl+C to stop');
  console.log('');

  await monitor.start();
}

// Export for testing
export { LPAggregator, PositionMonitor, DexRegistry };

// Run if executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
