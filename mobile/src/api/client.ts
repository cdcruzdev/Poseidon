import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'android'
  ? 'http://192.168.1.66:3001'
  : 'http://localhost:3001';

async function get<T>(path: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  } finally {
    clearTimeout(timer);
  }
}

export interface Pool {
  id: string;
  tokenA: string;
  tokenB: string;
  dex: string;
  yield24h: number;
  tvl: number;
  volume24h: number;
  score: number;
  feeTier: number;
}

export interface AgentAction {
  id: string;
  type: 'rebalance' | 'fee_collection' | 'alert' | 'deposit' | 'withdraw';
  description: string;
  timestamp: string;
  positionId?: string;
}

export interface AgentPerformance {
  totalRebalances: number;
  totalFeesCollected: number;
  avgResponseTime: number;
  uptime: number;
}

export const api = {
  healthCheck: () => get<{ status: string }>('/api/health'),
  fetchPools: async (tokenA?: string, tokenB?: string): Promise<Pool[]> => {
    // Fetch all 3 DEXes in parallel (like web app) for speed
    const dexes = ['orca', 'raydium', 'meteora'];
    const fetchDex = async (dex: string): Promise<any[]> => {
      try {
        const params = new URLSearchParams();
        if (tokenA) params.set('tokenA', tokenA);
        if (tokenB) params.set('tokenB', tokenB);
        params.set('dex', dex);
        params.set('limit', '20');
        return await get<any[]>(`/api/pools?${params.toString()}`, 8000);
      } catch { return []; }
    };
    const results = await Promise.all(dexes.map(fetchDex));
    const raw = results.flat();
    const mapped = (raw || []).map((p: any) => ({
      id: p.address,
      tokenA: typeof p.tokenA === 'string' ? p.tokenA : p.tokenA?.symbol || 'Unknown',
      tokenB: typeof p.tokenB === 'string' ? p.tokenB : p.tokenB?.symbol || 'Unknown',
      dex: p.dex,
      yield24h: p.yield24h ?? ((p.apr24h || p.estimatedApr || 0) / 365),
      tvl: p.tvl || 0,
      volume24h: p.volume24h || 0,
      score: Math.round((p.apr24h || 0) * 1.5 + Math.log10(Math.max(p.tvl || 1, 1)) * 5),
      feeTier: ((p.feeBps || 0) / 100),
    }));

    // Filter: minimum $100K TVL (same as web app)
    const filtered = mapped.filter(p => p.tvl >= 100_000);

    // Sort by yield weighted by TVL safety (same logic as web DepositCard)
    filtered.sort((a, b) => {
      const safeA = a.tvl >= 500_000 ? 1 : a.tvl >= 100_000 ? 0.5 : 0.1;
      const safeB = b.tvl >= 500_000 ? 1 : b.tvl >= 100_000 ? 0.5 : 0.1;
      return (b.yield24h * safeB) - (a.yield24h * safeA);
    });

    // Top 6 results
    return filtered.slice(0, 6);
  },
  fetchBestPool: (tokenA: string, tokenB: string) =>
    get<Pool>(`/api/best-pool?tokenA=${tokenA}&tokenB=${tokenB}`),
  fetchPrice: (symbol: string) =>
    get<{ price: number }>(`/api/price?symbol=${symbol}`),
  fetchAgentActivity: () =>
    get<AgentAction[]>('/api/agent/activity'),
  fetchAgentPerformance: () =>
    get<AgentPerformance>('/api/agent/performance'),
};
