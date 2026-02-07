/**
 * Price Oracle - Fetches token prices from CoinGecko
 * Used for accurate USD value display across all DEXs
 */

interface PriceCache {
  price: number;
  timestamp: number;
}

// CoinGecko token IDs for common Solana tokens
const COINGECKO_IDS: Record<string, string> = {
  'SOL': 'solana',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'JUP': 'jupiter-exchange-solana',
  'RAY': 'raydium',
  'ORCA': 'orca',
  'BONK': 'bonk',
  'WIF': 'dogwifcoin',
  'JTO': 'jito-governance-token',
  'PYTH': 'pyth-network',
  'RENDER': 'render-token',
  'HNT': 'helium',
  'MOBILE': 'helium-mobile',
  'W': 'wormhole',
  'TENSOR': 'tensor',
  'JITO': 'jito-governance-token',
  'mSOL': 'msol',
  'stSOL': 'lido-staked-sol',
  'jitoSOL': 'jito-staked-sol',
  'bSOL': 'blazestake-staked-sol',
};

// Stablecoins always return $1
const STABLECOINS = ['USDC', 'USDT', 'USDH', 'UXD', 'EURC'];

export class PriceOracle {
  private cache: Map<string, PriceCache> = new Map();
  private cacheTtlMs: number;
  private baseUrl = 'https://api.coingecko.com/api/v3';

  constructor(cacheTtlMs: number = 60_000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Get price for a single token
   */
  async getPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();

    // Stablecoins are always $1
    if (STABLECOINS.includes(upperSymbol)) {
      return 1.0;
    }

    // Check cache
    const cached = this.cache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.price;
    }

    // Fetch from CoinGecko
    const coingeckoId = COINGECKO_IDS[upperSymbol];
    if (!coingeckoId) {
      console.warn(`[PriceOracle] Unknown token: ${symbol}, returning 0`);
      return 0;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/simple/price?ids=${coingeckoId}&vs_currencies=usd`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json() as Record<string, { usd: number }>;
      const price = data[coingeckoId]?.usd ?? 0;

      // Update cache
      this.cache.set(upperSymbol, {
        price,
        timestamp: Date.now(),
      });

      return price;
    } catch (error) {
      console.error(`[PriceOracle] Failed to fetch price for ${symbol}:`, error);
      // Return cached value if available, even if stale
      return cached?.price ?? 0;
    }
  }

  /**
   * Get prices for multiple tokens (batched for efficiency)
   */
  async getPrices(symbols: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const toFetch: string[] = [];

    // Check cache and identify stablecoins
    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();

      if (STABLECOINS.includes(upperSymbol)) {
        result.set(upperSymbol, 1.0);
        continue;
      }

      const cached = this.cache.get(upperSymbol);
      if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
        result.set(upperSymbol, cached.price);
      } else if (COINGECKO_IDS[upperSymbol]) {
        toFetch.push(upperSymbol);
      } else {
        result.set(upperSymbol, 0);
      }
    }

    // Batch fetch remaining tokens
    if (toFetch.length > 0) {
      const ids = toFetch
        .map(s => COINGECKO_IDS[s])
        .filter(Boolean)
        .join(',');

      try {
        const response = await fetch(
          `${this.baseUrl}/simple/price?ids=${ids}&vs_currencies=usd`
        );

        if (response.ok) {
          const data = await response.json() as Record<string, { usd: number }>;

          for (const symbol of toFetch) {
            const coingeckoId = COINGECKO_IDS[symbol];
            const price = data[coingeckoId]?.usd ?? 0;

            this.cache.set(symbol, {
              price,
              timestamp: Date.now(),
            });
            result.set(symbol, price);
          }
        }
      } catch (error) {
        console.error('[PriceOracle] Batch fetch failed:', error);
        // Return cached or 0 for failed fetches
        for (const symbol of toFetch) {
          const cached = this.cache.get(symbol);
          result.set(symbol, cached?.price ?? 0);
        }
      }
    }

    return result;
  }

  /**
   * Calculate USD value of a token amount
   */
  async getValueUsd(symbol: string, amount: number): Promise<number> {
    const price = await this.getPrice(symbol);
    return price * amount;
  }

  /**
   * Clear the price cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let oracleInstance: PriceOracle | null = null;

export function getPriceOracle(): PriceOracle {
  if (!oracleInstance) {
    oracleInstance = new PriceOracle();
  }
  return oracleInstance;
}

export default PriceOracle;
