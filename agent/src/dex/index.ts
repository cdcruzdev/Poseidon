export * from './interface.js';
export { MeteoraAdapter } from './meteora.js';
export { OrcaAdapter } from './orca.js';
export { RaydiumAdapter } from './raydium.js';

import { DexRegistry } from './interface.js';
import { MeteoraAdapter } from './meteora.js';
import { OrcaAdapter } from './orca.js';
import { RaydiumAdapter } from './raydium.js';

/**
 * Create a pre-configured DEX registry with all supported adapters
 */
export function createDefaultRegistry(): DexRegistry {
  const registry = new DexRegistry();
  
  registry.register(new MeteoraAdapter());
  registry.register(new OrcaAdapter());
  registry.register(new RaydiumAdapter());
  
  return registry;
}
