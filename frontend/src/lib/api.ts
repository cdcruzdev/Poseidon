/**
 * Poseidon API Client
 * Connects frontend to the agent backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface TokenInfo {
  symbol: string;
  mint: string;
}

export interface Pool {
  address: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  dex: 'meteora' | 'orca' | 'raydium';
  tvl: number;
  volume24h: number;
  feeRate: number;
  currentPrice: number;
  apr24h: number;
  yield24h?: number; // actual 24h yield (apr24h / 365)
  tokenAPrice?: number;
  tokenBPrice?: number;
  estimatedApr?: number;
  rank?: number;
  poolType?: 'DLMM' | 'DAMM_V2' | 'Whirlpool' | 'CLMM' | 'unknown';
}

export interface CompareResult {
  tokenA: string;
  tokenB: string;
  tokenAPrice: number;
  tokenBPrice: number;
  pools: Pool[];
  recommendation: {
    dex: string;
    address: string;
    estimatedApr: number;
    reason: string;
  } | null;
}

export interface AgentStatus {
  status: string;
  adapters: string[];
  supportedTokens: string[];
  timestamp: number;
}

async function fetchApi<T>(endpoint: string, retries = 3): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: ApiResponse<T> = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data.data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on client errors (4xx)
      if (lastError.message.includes('HTTP 4')) {
        throw lastError;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }
  
  throw lastError || new Error('API request failed after retries');
}

/**
 * Get pools for a token pair
 */
export async function getPools(
  tokenA: string,
  tokenB: string,
  options?: { dex?: string; limit?: number }
): Promise<Pool[]> {
  const params = new URLSearchParams({
    tokenA,
    tokenB,
    ...(options?.dex && { dex: options.dex }),
    ...(options?.limit && { limit: options.limit.toString() }),
  });
  
  return fetchApi<Pool[]>(`/api/pools?${params}`);
}

/**
 * Get price for a single token
 */
export async function getPrice(symbol: string): Promise<number> {
  const data = await fetchApi<{ symbol: string; price: number }>(`/api/price?symbol=${symbol}`);
  return data.price;
}

/**
 * Get prices for multiple tokens
 */
export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  return fetchApi<Record<string, number>>(`/api/prices?symbols=${symbols.join(',')}`);
}

/**
 * Compare pools for a token pair
 */
export async function comparePools(tokenA: string, tokenB: string): Promise<CompareResult> {
  return fetchApi<CompareResult>(`/api/compare?tokenA=${tokenA}&tokenB=${tokenB}`);
}

/**
 * Get agent status
 */
export async function getAgentStatus(): Promise<AgentStatus> {
  return fetchApi<AgentStatus>('/api/status');
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await fetchApi<{ status: string }>('/health');
    return true;
  } catch {
    return false;
  }
}

// Format helpers
export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
