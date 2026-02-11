"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/api";

export interface AgentAction {
  id: string;
  timestamp: string;
  type: "rebalance" | "scan" | "alert" | "deposit" | "withdraw" | "optimize";
  pair: string;
  dex: string;
  description: string;
  details?: string;
  status: "completed" | "pending" | "failed";
}

const typeIcons: Record<AgentAction["type"], JSX.Element> = {
  rebalance: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2">
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  ),
  scan: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  alert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
    </svg>
  ),
  deposit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  ),
  withdraw: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  optimize: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
};

const statusDot: Record<AgentAction["status"], string> = {
  completed: "#22C55E",
  pending: "#FBBF24",
  failed: "#EF4444",
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgentActivityLog() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`${API_BASE}/api/agent/activity`);
        const json = await res.json();
        if (json.success && json.data?.activities) {
          setActions(json.data.activities);
        }
      } catch {
        // silently fail -- show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  const visibleActions = showAll ? actions : actions.slice(0, 3);

  return (
    <div className="bg-[#0a1520]/80 backdrop-blur-sm rounded-xl border border-[#1a3050] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#1a3050] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          <h3 className="font-semibold text-sm tracking-wider text-[#e0e8f0]" style={{ fontFamily: 'var(--font-bebas)' }}>
            AGENT ACTIVITY
          </h3>
        </div>
        <span className="text-xs text-[#5a7090]">Autonomous</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-5 h-5 border-2 border-[#1a3050] border-t-[#7ec8e8] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#5a7090]">Loading activity...</p>
        </div>
      ) : actions.length === 0 ? (
        <div className="p-8 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5a7090" strokeWidth="1.5" className="mx-auto mb-3">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <p className="text-sm text-[#8899aa]">No activity yet</p>
          <p className="text-xs text-[#5a7090] mt-1">The agent will log actions here once it starts operating</p>
        </div>
      ) : (
        <>
          {/* Actions */}
          <div className="divide-y divide-[#1a3050]/50">
            {visibleActions.map((action) => (
              <button
                key={action.id}
                onClick={() => setExpanded(expanded === action.id ? null : action.id)}
                className="w-full text-left p-3 hover:bg-[#0d1d30]/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{typeIcons[action.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-[#e0e8f0] truncate">{action.description}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: statusDot[action.status] }}
                        />
                        <span className="text-xs text-[#5a7090]">{timeAgo(action.timestamp)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#5a7090] mt-0.5">
                      {action.pair} on {action.dex}
                    </p>
                    {expanded === action.id && action.details && (
                      <p className="text-xs text-[#8899aa] mt-2 p-2 bg-[#0a1520]/60 rounded-lg">
                        {action.details}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Show more */}
          {actions.length > 3 && (
            <div className="p-3 border-t border-[#1a3050]">
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-xs text-[#5a7090] hover:text-[#8899aa] transition-colors"
              >
                {showAll ? "Show less" : `Show ${actions.length - 3} more actions`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
