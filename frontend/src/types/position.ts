export interface Position {
  id: string;
  pair: string;
  dex: string;
  deposited: string;
  current: string;
  pnl: string;
  pnlPct: string;
  apy: string;
  range: string;
  status: "in-range" | "out-of-range";
  rebalances: number;
  age: string;
  feesEarned: string;
  nextRebalance: string;
}
