import { Platform } from 'react-native';

const API_BASE = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
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
  fetchPools: (tokenA?: string, tokenB?: string) => {
    const params = new URLSearchParams();
    if (tokenA) params.set('tokenA', tokenA);
    if (tokenB) params.set('tokenB', tokenB);
    const q = params.toString();
    return get<Pool[]>(`/api/pools${q ? `?${q}` : ''}`);
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
