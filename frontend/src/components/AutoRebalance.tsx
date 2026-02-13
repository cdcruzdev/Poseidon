"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Toggle from "@/components/Toggle";
import AnimateHeight from "@/components/AnimateHeight";

interface AutoRebalanceProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  targetYield: string;
  onTargetYieldChange: (yield_: string) => void;
}

const YIELD_OPTIONS = [
  { value: "0.10", label: "0.10%" },
  { value: "0.25", label: "0.25%" },
  { value: "0.50", label: "0.50%" },
];

export default function AutoRebalance({
  enabled,
  onEnabledChange,
  targetYield,
  onTargetYieldChange,
}: AutoRebalanceProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showYieldDropdown, setShowYieldDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback(
    (newEnabled: boolean) => {
      onEnabledChange(newEnabled);
    },
    [onEnabledChange]
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
            <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px] font-bold leading-none">i</span>
          </button>
        </div>
        <Toggle enabled={enabled} onChange={handleToggle} />
      </div>

      <AnimateHeight open={showInfo}>
        <div className="mt-2 p-3 bg-[#0a1520]/60 rounded-lg text-xs text-[#8899aa]">
          Our agent monitors your position 24/7. If the price moves out of range 
          or yield drops below your target, we automatically rebalance to the optimal range.
          5% fee on earned fees. This setting is stored on-chain via the Poseidon rebalance program.
        </div>
      </AnimateHeight>

      <AnimateHeight open={enabled} duration={300}>
        <div className="mt-2 flex items-center gap-2 relative">
          <span className="text-xs text-[#5a7090]">Target 24h Yield:</span>
          <div className="relative">
            <button
              ref={triggerRef}
              onClick={() => {
                if (triggerRef.current) {
                  const rect = triggerRef.current.getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                }
                setShowYieldDropdown(!showYieldDropdown);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a1520]/60 border border-[#1a3050] rounded-lg text-xs text-[#e0e8f0] hover:border-[#7ec8e8]/50 transition-colors cursor-pointer"
            >
              <span className="text-[#7ec8e8] font-medium">{YIELD_OPTIONS.find(o => o.value === targetYield)?.label || targetYield}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5a7090"
                strokeWidth="2"
                className={`transition-transform ${showYieldDropdown ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showYieldDropdown && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowYieldDropdown(false)} />
                <div
                  className="fixed z-[9999] bg-[#0d1d30] border border-[#1a3050] rounded-xl shadow-xl shadow-black/40 min-w-[100px]"
                  style={{
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    transformOrigin: "top left",
                    animation: "dropdown-in 180ms ease-out forwards",
                  }}
                >
                  {YIELD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onTargetYieldChange(option.value);
                        setShowYieldDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                        option.value === targetYield
                          ? "bg-[#7ec8e8]/15 text-[#7ec8e8] font-medium"
                          : "text-[#8899aa] hover:bg-[#1a3050] hover:text-[#e0e8f0]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>,
              document.body
            )}
          </div>
        </div>
      </AnimateHeight>
    </div>
  );
}
