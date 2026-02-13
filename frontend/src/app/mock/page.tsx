"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import AnimateHeight from "@/components/AnimateHeight";
import PositionList from "@/components/PositionList";
import type { Position } from "@/types/position";

/* ── Mock Data ─────────────────────────────────────────── */

const POSITIONS: Position[] = [
  {
    id: "pos-1", pair: "SOL / USDC", dex: "Orca",
    deposited: "$4,280.00", current: "$4,512.34", pnl: "+$232.34", pnlPct: "+5.43%",
    apy: "42.1%", range: "120.50 — 185.00", status: "in-range", rebalances: 3, age: "4d",
    feesEarned: "$68.20", nextRebalance: "~2h",
  },
  {
    id: "pos-2", pair: "JUP / USDC", dex: "Meteora",
    deposited: "$1,500.00", current: "$1,647.80", pnl: "+$147.80", pnlPct: "+9.85%",
    apy: "67.3%", range: "0.82 — 1.40", status: "in-range", rebalances: 7, age: "6d",
    feesEarned: "$41.50", nextRebalance: "~45m",
  },
  {
    id: "pos-3", pair: "WIF / SOL", dex: "Raydium",
    deposited: "$820.00", current: "$791.14", pnl: "-$28.86", pnlPct: "-3.52%",
    apy: "118.7%", range: "0.0041 — 0.0089", status: "out-of-range", rebalances: 12, age: "2d",
    feesEarned: "$22.10", nextRebalance: "Pending",
  },
  {
    id: "pos-4", pair: "BONK / SOL", dex: "Orca",
    deposited: "$2,100.00", current: "$2,340.60", pnl: "+$240.60", pnlPct: "+11.46%",
    apy: "89.4%", range: "0.0000018 — 0.0000035", status: "in-range", rebalances: 9, age: "8d",
    feesEarned: "$112.30", nextRebalance: "~3h",
  },
  {
    id: "pos-5", pair: "RAY / USDC", dex: "Raydium",
    deposited: "$950.00", current: "$1,012.40", pnl: "+$62.40", pnlPct: "+6.57%",
    apy: "54.2%", range: "1.80 — 3.60", status: "in-range", rebalances: 4, age: "5d",
    feesEarned: "$28.90", nextRebalance: "~1h",
  },
  {
    id: "pos-6", pair: "PYTH / USDC", dex: "Meteora",
    deposited: "$600.00", current: "$571.20", pnl: "-$28.80", pnlPct: "-4.80%",
    apy: "35.8%", range: "0.28 — 0.52", status: "out-of-range", rebalances: 2, age: "3d",
    feesEarned: "$8.40", nextRebalance: "Pending",
  },
  {
    id: "pos-7", pair: "RNDR / SOL", dex: "Orca",
    deposited: "$3,200.00", current: "$3,456.80", pnl: "+$256.80", pnlPct: "+8.03%",
    apy: "61.7%", range: "0.042 — 0.078", status: "in-range", rebalances: 6, age: "10d",
    feesEarned: "$94.60", nextRebalance: "~4h",
  },
  {
    id: "pos-8", pair: "JITO / USDC", dex: "Meteora",
    deposited: "$1,800.00", current: "$1,932.50", pnl: "+$132.50", pnlPct: "+7.36%",
    apy: "48.9%", range: "2.40 — 4.80", status: "in-range", rebalances: 5, age: "7d",
    feesEarned: "$52.70", nextRebalance: "~2h",
  },
];

const ACTIVITIES = [
  { id: "a1", type: "rebalance", pair: "SOL / USDC", dex: "Orca", desc: "Rebalanced to tighter range after SOL pump", time: "12m ago", status: "completed" },
  { id: "a2", type: "scan", pair: "JUP / USDC", dex: "Meteora", desc: "Pool scan: yield still optimal, no action needed", time: "28m ago", status: "completed" },
  { id: "a3", type: "rebalance", pair: "WIF / SOL", dex: "Raydium", desc: "Emergency rebalance: position drifted out of range", time: "1h ago", status: "completed" },
  { id: "a4", type: "optimize", pair: "BONK / SOL", dex: "Orca", desc: "Narrowed range 5% for higher fee capture", time: "3h ago", status: "completed" },
  { id: "a5", type: "deposit", pair: "JUP / USDC", dex: "Meteora", desc: "Auto-compounded $18.40 in earned fees", time: "5h ago", status: "completed" },
  { id: "a6", type: "alert", pair: "PYTH / USDC", dex: "Meteora", desc: "High volatility detected, widening range as precaution", time: "8h ago", status: "completed" },
  { id: "a7", type: "rebalance", pair: "RNDR / SOL", dex: "Orca", desc: "Shifted range up 8% following momentum", time: "12h ago", status: "completed" },
  { id: "a8", type: "scan", pair: "JITO / USDC", dex: "Meteora", desc: "Checked 14 JITO pools, current still best", time: "14h ago", status: "completed" },
  { id: "a9", type: "optimize", pair: "RAY / USDC", dex: "Raydium", desc: "Reduced spread from 40% to 28% width", time: "18h ago", status: "completed" },
  { id: "a10", type: "deposit", pair: "SOL / USDC", dex: "Orca", desc: "Auto-compounded $32.10 in earned fees", time: "1d ago", status: "completed" },
];

const REASONING = [
  {
    id: "r1",
    decision: "Rebalance SOL/USDC to 135.20 — 172.80 range",
    confidence: 94, outcome: "positive" as const, time: "12m ago",
    reasoning: [
      "SOL price moved from $148 to $156 in last 4h (+5.4%)",
      "Current range utilization dropped to 62% — fee capture declining",
      "30m TWAP shows sustained upward momentum, not a wick",
      "New range centers on $154 with 12% spread — balances fee capture vs IL risk",
    ],
    metrics: [
      { label: "Old Range", value: "120.50 — 185.00" },
      { label: "New Range", value: "135.20 — 172.80" },
      { label: "Est. APY Δ", value: "+18.3%" },
      { label: "Gas", value: "0.0021 SOL" },
    ],
  },
  {
    id: "r2",
    decision: "Hold JUP/USDC position — no rebalance needed",
    confidence: 88, outcome: "neutral" as const, time: "28m ago",
    reasoning: [
      "JUP price at $1.12, centered in range (0.82 — 1.40)",
      "Range utilization at 89% — strong fee capture",
      "24h volume $2.1M on this pool, above average",
      "No rebalance = no gas cost, position is performing well",
    ],
    metrics: [
      { label: "Utilization", value: "89%" },
      { label: "24h Fees", value: "$14.20" },
    ],
  },
  {
    id: "r3",
    decision: "Emergency rebalance WIF/SOL after range exit",
    confidence: 76, outcome: "negative" as const, time: "1h ago",
    reasoning: [
      "WIF dumped 11% in 30min, position now 100% SOL (out of range)",
      "Earning zero fees while out of range — opportunity cost is high",
      "Volatility still elevated — using wider range (2x normal) as hedge",
      "Lower confidence: could dump further, but earning nothing isn't viable",
    ],
    metrics: [
      { label: "IL Impact", value: "-$28.86" },
      { label: "New Width", value: "2x normal" },
      { label: "Gas", value: "0.0034 SOL" },
    ],
  },
  {
    id: "r4",
    decision: "Narrow BONK/SOL range for higher fee capture",
    confidence: 91, outcome: "positive" as const, time: "3h ago",
    reasoning: [
      "BONK consolidating in tight range for 48h — low volatility regime",
      "Current 94% range width is too wide, capturing only 41% of possible fees",
      "Narrowing to 60% width increases fee share by ~2.3x",
      "Risk: sudden breakout could push out of range, but agent monitors every 5min",
    ],
    metrics: [
      { label: "Old Width", value: "94%" },
      { label: "New Width", value: "60%" },
      { label: "Fee Δ", value: "+2.3x" },
      { label: "Gas", value: "0.0019 SOL" },
    ],
  },
];

/* ── Helpers ────────────────────────────────────────────── */

const typeColors: Record<string, string> = {
  rebalance: "#FBBF24", scan: "#3B82F6", alert: "#EF4444",
  deposit: "#22C55E", withdraw: "#F59E0B", optimize: "#8B5CF6",
};

function confidenceColor(c: number): string {
  if (c >= 90) return "#4ade80";
  if (c >= 75) return "#fbbf24";
  return "#f87171";
}
function outcomeColor(o: string): string {
  if (o === "positive") return "#4ade80";
  if (o === "negative") return "#f87171";
  return "#fbbf24";
}
function outcomeIcon(o: string): string {
  if (o === "positive") return "✓";
  if (o === "negative") return "✗";
  return "—";
}

/* ── Page ───────────────────────────────────────────────── */

export default function MockPage() {
  const [expandedReasoning, setExpandedReasoning] = useState<string | null>("r1");
  const [showAllActivity, setShowAllActivity] = useState(false);

  // Portfolio totals
  const totalValue = POSITIONS.reduce((s, p) => s + parseFloat(p.current.replace(/[,$]/g, "")), 0);
  const totalDeposited = POSITIONS.reduce((s, p) => s + parseFloat(p.deposited.replace(/[,$]/g, "")), 0);
  const totalPnl = totalValue - totalDeposited;
  const totalFees = POSITIONS.reduce((s, p) => s + parseFloat(p.feesEarned.replace(/[,$]/g, "")), 0);
  const totalRebalances = POSITIONS.reduce((s, p) => s + p.rebalances, 0);
  const avgApy = POSITIONS.reduce((s, p) => s + parseFloat(p.apy), 0) / POSITIONS.length;

  const visibleActivities = showAllActivity ? ACTIVITIES : ACTIVITIES.slice(0, 4);

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a1520]/90 backdrop-blur-md border-b border-[#1a3050]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
            <Image src="/poseidon-logo.svg" alt="Poseidon" width={28} height={28} />
            <span className="tracking-[0.25em] text-[#e0e8f0] text-lg" style={{ fontFamily: "var(--font-bebas)" }}>
              POSEIDON
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#fbbf24] bg-[#fbbf24]/10 px-3 py-1.5 rounded-lg border border-[#fbbf24]/30">
              DEMO VIEW
            </span>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero */}
          <section className="text-center mb-10">
            <h1 className="text-3xl sm:text-5xl tracking-wider mb-3" style={{ fontFamily: "var(--font-bebas)" }}>
              <span className="metallic-text">ONE CLICK LP.</span>{" "}
              <span className="text-[#ffffff]">BEST YIELDS.</span>
            </h1>
            <p className="text-[#b8c8d8] text-base sm:text-lg max-w-xl mx-auto">
              Deposit liquidity across all major DEXs. We find the optimal pool automatically.
            </p>
          </section>

          {/* Portfolio Stats */}
          <section className="mb-10 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Value", value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#e0e8f0" },
                { label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: totalPnl >= 0 ? "#4ade80" : "#f87171" },
                { label: "Fees Earned", value: `$${totalFees.toFixed(2)}`, color: "#4ade80" },
                { label: "Avg APY", value: `${avgApy.toFixed(1)}%`, color: "#7ec8e8" },
                { label: "Positions", value: `${POSITIONS.length}`, color: "#e0e8f0" },
                { label: "Rebalances", value: `${totalRebalances}`, color: "#fbbf24" },
              ].map((s) => (
                <div key={s.label} className="bg-[#0d1926]/80 border border-[#1a3050] rounded-xl p-3 text-center">
                  <p className="text-[10px] text-[#5a7090] uppercase tracking-wider mb-1">{s.label}</p>
                  <p className="text-lg font-mono font-semibold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Positions */}
          <section className="mb-10 max-w-4xl mx-auto">
            <PositionList positions={POSITIONS} />
          </section>

          {/* Agent Section - Side by Side */}
          <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Activity Log */}
            <div className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] overflow-hidden">
              <div className="p-4 border-b border-[#1a3050] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                  <h3 className="font-semibold text-sm tracking-wider text-[#e0e8f0]" style={{ fontFamily: "var(--font-bebas)" }}>
                    AGENT ACTIVITY
                  </h3>
                </div>
                <span className="text-xs text-[#5a7090]">Autonomous</span>
              </div>
              <div className="divide-y divide-[#1a3050]/50">
                {visibleActivities.map((a) => (
                  <div key={a.id} className="p-3 hover:bg-[#0d1d30]/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: typeColors[a.type] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-[#e0e8f0] truncate">{a.desc}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                            <span className="text-xs text-[#5a7090]">{a.time}</span>
                          </div>
                        </div>
                        <p className="text-xs text-[#5a7090] mt-0.5">{a.pair} on {a.dex}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {ACTIVITIES.length > 4 && (
                <div className="p-3 border-t border-[#1a3050]">
                  <button
                    onClick={() => setShowAllActivity(!showAllActivity)}
                    className="w-full text-xs text-[#5a7090] hover:text-[#8899aa] transition-colors cursor-pointer"
                  >
                    {showAllActivity ? "Show less" : `Show ${ACTIVITIES.length - 4} more actions`}
                  </button>
                </div>
              )}
            </div>

            {/* Reasoning Panel */}
            <div className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] overflow-hidden">
              <div className="p-4 border-b border-[#1a3050] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <h3 className="font-semibold text-sm tracking-wider text-[#e0e8f0]" style={{ fontFamily: "var(--font-bebas)" }}>
                    AGENT REASONING
                  </h3>
                </div>
                <span className="text-xs text-[#5a7090]">Transparent Decisions</span>
              </div>
              <div className="divide-y divide-[#1a3050]/50">
                {REASONING.map((step) => (
                  <div key={step.id}>
                    <button
                      onClick={() => setExpandedReasoning(expandedReasoning === step.id ? null : step.id)}
                      className="w-full text-left p-4 hover:bg-[#0d1d30]/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                              style={{ color: confidenceColor(step.confidence), backgroundColor: `${confidenceColor(step.confidence)}15` }}
                            >
                              {step.confidence}%
                            </span>
                            <span className="text-xs font-bold" style={{ color: outcomeColor(step.outcome) }}>
                              {outcomeIcon(step.outcome)}
                            </span>
                            <span className="text-xs text-[#5a7090]">{step.time}</span>
                          </div>
                          <p className="text-sm text-[#e0e8f0]">{step.decision}</p>
                        </div>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a7090" strokeWidth="2"
                          className={`shrink-0 transition-transform duration-200 ${expandedReasoning === step.id ? "rotate-180" : ""}`}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </button>
                    <AnimateHeight open={expandedReasoning === step.id}>
                      <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-1.5 pl-2 border-l-2 border-[#8B5CF6]/30">
                          {step.reasoning.map((r, i) => (
                            <p key={i} className="text-xs text-[#8899aa] pl-3">{r}</p>
                          ))}
                        </div>
                        {step.metrics && (
                          <div className="flex gap-2 flex-wrap">
                            {step.metrics.map((m) => (
                              <div key={m.label} className="bg-[#0a1520]/60 rounded-lg px-3 py-1.5">
                                <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">{m.label}</p>
                                <p className="text-xs text-[#e0e8f0] font-mono">{m.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </AnimateHeight>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Agent Performance */}
          <section className="mb-10 max-w-2xl mx-auto">
            <div className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] overflow-hidden">
              <div className="p-4 border-b border-[#1a3050] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <h3 className="font-semibold text-sm tracking-wider text-[#e0e8f0]" style={{ fontFamily: "var(--font-bebas)" }}>
                    AGENT PERFORMANCE
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#5a7090]">Uptime: 6d 14h</span>
                  <span className="text-xs text-[#8899aa] bg-[#1a3050] px-2.5 py-1 rounded-md">All Time</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {[
                  { label: "Fees Earned", value: `$${totalFees.toFixed(2)}`, color: "#4ade80" },
                  { label: "Net Profit", value: `$${(totalFees - 3.84).toFixed(2)}`, color: "#4ade80", sub: "after 0.024 SOL gas" },
                  { label: "IL Saved", value: "$156.40", color: "#8B5CF6", sub: "vs static position" },
                  { label: "Gas Spent", value: "0.024 SOL", color: "#fbbf24" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#0a1520]/60 rounded-lg p-3">
                    <p className="text-[10px] text-[#5a7090] uppercase tracking-wider mb-1">{stat.label}</p>
                    <p className="text-lg font-semibold font-mono" style={{ color: stat.color }}>{stat.value}</p>
                    {stat.sub && <p className="text-[10px] text-[#5a7090] mt-0.5">{stat.sub}</p>}
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4 space-y-3">
                {[
                  { label: "Success Rate", value: 96, color: "#4ade80" },
                  { label: "Avg Confidence", value: 87, color: "#8B5CF6" },
                  { label: "Uptime", value: 99.8, color: "#3B82F6" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#8899aa]">{bar.label}</span>
                      <span className="text-xs font-mono" style={{ color: bar.color }}>{bar.value}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1a3050] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${bar.value}%`, backgroundColor: bar.color }} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#1a3050]/50">
                  <span className="text-xs text-[#5a7090]">{totalRebalances + 26} actions -- {totalRebalances} rebalances -- 0 migrations</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-[#1a3050]/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="tracking-widest text-[#8899aa]" style={{ fontFamily: "var(--font-bebas)" }}>POSEIDON</span>
          <div className="flex items-center gap-2 text-[#5a7090] text-xs">
            <span>Powered by</span>
            <span className="text-[#7ec8e8]">Meteora</span>
            <span className="text-[#3a5070]">|</span>
            <span className="text-[#7ec8e8]">Orca</span>
            <span className="text-[#3a5070]">|</span>
            <span className="text-[#7ec8e8]">Raydium</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
