"use client";

import { useState } from "react";
import AnimateHeight from "./AnimateHeight";

interface ReasoningStep {
  id: string;
  timestamp: string;
  decision: string;
  reasoning: string[];
  confidence: number;
  outcome?: "positive" | "neutral" | "negative";
  metrics?: { label: string; value: string }[];
}

const demoReasoning: ReasoningStep[] = [
  {
    id: "r1",
    timestamp: new Date(Date.now() - 180000).toISOString(),
    decision: "Rebalance SOL/USDC to bins 8,420-8,580",
    reasoning: [
      "Current price $189.42 drifted 1.2% from position center",
      "Position earning 0% fees while out of active bins",
      "Gas cost ~0.002 SOL vs projected 0.18% yield recovery in 4h",
      "Net positive ROI within 2 hours of rebalance",
    ],
    confidence: 92,
    outcome: "positive",
    metrics: [
      { label: "Gas Cost", value: "0.002 SOL" },
      { label: "Projected Recovery", value: "4h" },
      { label: "Range Width", value: "±1.5%" },
    ],
  },
  {
    id: "r2",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    decision: "Migrate JUP/USDC from Orca to Meteora",
    reasoning: [
      "Orca Whirlpool yield dropped from 0.21% to 0.08% over 12h",
      "Meteora DLMM offering 0.22% for same pair with higher volume",
      "Migration cost: 0.004 SOL (withdraw + deposit)",
      "Break-even in 6.2 hours at current rates",
      "Historical pattern: Meteora sustains yield 3x longer for this pair",
    ],
    confidence: 87,
    outcome: "positive",
    metrics: [
      { label: "Yield Delta", value: "+0.14%" },
      { label: "Break-even", value: "6.2h" },
      { label: "Migration Cost", value: "0.004 SOL" },
    ],
  },
  {
    id: "r3",
    timestamp: new Date(Date.now() - 2700000).toISOString(),
    decision: "HOLD WIF/USDC position despite 8.2% price drop",
    reasoning: [
      "Volatility spike detected — rebalancing during high vol wastes gas",
      "Historical pattern: WIF recovers within 4-8h after drops >5%",
      "IL at current deviation: 0.34% — within acceptable threshold",
      "Waiting for 1h volatility to drop below 2% before rebalancing",
    ],
    confidence: 74,
    outcome: "neutral",
    metrics: [
      { label: "IL Impact", value: "0.34%" },
      { label: "Vol (1h)", value: "4.8%" },
      { label: "Wait Target", value: "<2% vol" },
    ],
  },
  {
    id: "r4",
    timestamp: new Date(Date.now() - 5400000).toISOString(),
    decision: "Skip BONK/SOL rebalance — fee capture optimal",
    reasoning: [
      "Position centered within 0.3% of current price",
      "Volume surge generating 4.82% 24h yield",
      "Rebalancing would disrupt active fee capture during peak",
      "Decision: let the position ride until volume normalizes",
    ],
    confidence: 96,
    outcome: "positive",
  },
];

function confidenceColor(c: number): string {
  if (c >= 90) return "#4ade80";
  if (c >= 75) return "#fbbf24";
  return "#f87171";
}

function outcomeIcon(o?: "positive" | "neutral" | "negative"): string {
  if (o === "positive") return "✓";
  if (o === "negative") return "✗";
  return "—";
}

function outcomeColor(o?: "positive" | "neutral" | "negative"): string {
  if (o === "positive") return "#4ade80";
  if (o === "negative") return "#f87171";
  return "#fbbf24";
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgentReasoningPanel() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1a3050] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <h3
            className="font-semibold text-sm tracking-wider text-[#e0e8f0]"
            style={{ fontFamily: "var(--font-bebas)" }}
          >
            AGENT REASONING
          </h3>
        </div>
        <span className="text-xs text-[#5a7090]">Transparent Decisions</span>
      </div>

      {/* Reasoning Steps */}
      <div className="divide-y divide-[#1a3050]/50">
        {demoReasoning.map((step) => (
          <div key={step.id}>
            <button
              onClick={() => setExpanded(expanded === step.id ? null : step.id)}
              className="w-full text-left p-4 hover:bg-[#0d1d30]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: confidenceColor(step.confidence),
                        backgroundColor: `${confidenceColor(step.confidence)}15`,
                      }}
                    >
                      {step.confidence}%
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: outcomeColor(step.outcome) }}
                    >
                      {outcomeIcon(step.outcome)}
                    </span>
                    <span className="text-xs text-[#5a7090]">{timeAgo(step.timestamp)}</span>
                  </div>
                  <p className="text-sm text-[#e0e8f0]">{step.decision}</p>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5a7090"
                  strokeWidth="2"
                  className={`shrink-0 transition-transform duration-200 ${
                    expanded === step.id ? "rotate-180" : ""
                  }`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </button>

            <AnimateHeight open={expanded === step.id}>
              <div className="px-4 pb-4 space-y-3">
                {/* Reasoning chain */}
                <div className="space-y-1.5 pl-2 border-l-2 border-[#8B5CF6]/30">
                  {step.reasoning.map((r, i) => (
                    <p key={i} className="text-xs text-[#8899aa] pl-3">
                      {r}
                    </p>
                  ))}
                </div>

                {/* Metrics */}
                {step.metrics && (
                  <div className="flex gap-3 flex-wrap">
                    {step.metrics.map((m) => (
                      <div
                        key={m.label}
                        className="bg-[#0a1520]/60 rounded-lg px-3 py-1.5"
                      >
                        <p className="text-[10px] text-[#5a7090] uppercase tracking-wider">
                          {m.label}
                        </p>
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
  );
}
