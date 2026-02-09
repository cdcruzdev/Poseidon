"use client";

import { useState, useEffect, useCallback } from "react";
import Toggle from "@/components/Toggle";
import AnimateHeight from "@/components/AnimateHeight";
import { useRebalanceProgram } from "@/hooks/useRebalanceProgram";

interface AutoRebalanceProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  targetYield: string;
  onTargetYieldChange: (yield_: string) => void;
}

const YIELD_OPTIONS = [
  { value: "0.05", label: "0.05%" },
  { value: "0.10", label: "0.10%" },
  { value: "0.15", label: "0.15%" },
  { value: "0.20", label: "0.20%" },
  { value: "0.25", label: "0.25%" },
];

export default function AutoRebalance({
  enabled,
  onEnabledChange,
  targetYield,
  onTargetYieldChange,
}: AutoRebalanceProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const {
    fetchConfig,
    enableRebalance,
    disableRebalance,
    walletConnected,
  } = useRebalanceProgram();

  // Fetch on-chain state on mount
  useEffect(() => {
    if (!walletConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchConfig();
        if (!cancelled && cfg) {
          onEnabledChange(cfg.enabled);
        }
      } catch {
        // ignore fetch errors on mount
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected]);

  const handleToggle = useCallback(
    async (newEnabled: boolean) => {
      if (!walletConnected) {
        setStatus({ type: "error", msg: "Connect wallet first" });
        return;
      }
      setLoading(true);
      setStatus(null);
      try {
        if (newEnabled) {
          const sig = await enableRebalance(100, 50); // 1% slippage, 0.5% min yield
          setStatus({ type: "success", msg: `Enabled! Tx: ${sig.slice(0, 8)}…` });
        } else {
          const sig = await disableRebalance();
          setStatus({ type: "success", msg: `Disabled! Tx: ${sig.slice(0, 8)}…` });
        }
        onEnabledChange(newEnabled);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setStatus({ type: "error", msg });
      } finally {
        setLoading(false);
      }
    },
    [walletConnected, enableRebalance, disableRebalance, onEnabledChange]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Auto-Rebalancing</span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-[#5a7090] hover:text-[#ffffff] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
          {loading && (
            <svg className="animate-spin h-4 w-4 text-[#7ec8e8]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <Toggle enabled={enabled} onChange={handleToggle} />
      </div>

      {status && (
        <div
          className={`mt-2 text-xs px-2 py-1 rounded ${
            status.type === "success"
              ? "text-[#4ade80] bg-[#4ade80]/10"
              : "text-[#f87171] bg-[#f87171]/10"
          }`}
        >
          {status.msg}
        </div>
      )}

      <AnimateHeight open={showInfo}>
        <div className="mt-2 p-3 bg-[#0a1520]/60 rounded-lg text-xs text-[#8899aa]">
          Our agent monitors your position 24/7. If the price moves out of range 
          or yield drops below your target, we automatically rebalance to the optimal range.
          This setting is stored on-chain via the Poseidon rebalance program.
        </div>
      </AnimateHeight>

      <AnimateHeight open={enabled}>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[#5a7090]">Target 24h Yield:</span>
          <select
            value={targetYield}
            onChange={(e) => onTargetYieldChange(e.target.value)}
            className="px-2 py-1 bg-[#0a1520]/60 border border-[#1a3050] rounded-md text-xs focus:border-[#2a4060] focus:outline-none cursor-pointer"
          >
            {YIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </AnimateHeight>
    </div>
  );
}
