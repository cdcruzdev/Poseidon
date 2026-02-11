"use client";

import { useState, useEffect } from "react";
import AnimateHeight from "./AnimateHeight";
import { API_BASE } from "@/lib/api";

interface ReasoningStep {
  id: string;
  timestamp: string;
  decision: string;
  reasoning: string[];
  confidence: number;
  outcome?: "positive" | "neutral" | "negative";
  metrics?: { label: string; value: string }[];
}

function confidenceColor(c: number): string {
  if (c >= 90) return "#4ade80";
  if (c >= 75) return "#fbbf24";
  return "#f87171";
}

function outcomeIcon(o?: "positive" | "neutral" | "negative"): string {
  if (o === "positive") return "OK";
  if (o === "negative") return "X";
  return "--";
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
  const [decisions, setDecisions] = useState<ReasoningStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReasoning() {
      try {
        const res = await fetch(`${API_BASE}/api/agent/reasoning`);
        const json = await res.json();
        if (json.success && json.data?.decisions) {
          setDecisions(json.data.decisions);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchReasoning();
    const interval = setInterval(fetchReasoning, 30000);
    return () => clearInterval(interval);
  }, []);

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

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-5 h-5 border-2 border-[#1a3050] border-t-[#7ec8e8] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#5a7090]">Loading reasoning...</p>
        </div>
      ) : decisions.length === 0 ? (
        <div className="p-8 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5a7090" strokeWidth="1.5" className="mx-auto mb-3">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-sm text-[#8899aa]">No decisions yet</p>
          <p className="text-xs text-[#5a7090] mt-1">The agent will show its reasoning here as it makes decisions</p>
        </div>
      ) : (
        /* Reasoning Steps */
        <div className="divide-y divide-[#1a3050]/50">
          {decisions.map((step) => (
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
      )}
    </div>
  );
}
