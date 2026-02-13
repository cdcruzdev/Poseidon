"use client";

import { useState } from "react";
import Toggle from "@/components/Toggle";
import AnimateHeight from "@/components/AnimateHeight";
import FadeSlideIn from "@/components/FadeSlideIn";

interface PrivacyToggleProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export default function PrivacyToggle({
  enabled,
  onEnabledChange,
}: PrivacyToggleProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke={enabled ? "#7ec8e8" : "#5a7090"} 
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-sm font-medium">Private Position</span>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-[#5a7090] hover:text-[#ffffff] transition-colors"
          >
            <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px] font-bold leading-none">i</span>
          </button>
        </div>
        <Toggle enabled={enabled} onChange={onEnabledChange} />
      </div>

      <AnimateHeight open={showInfo}>
        <div className="mt-2 p-3 bg-[#0a1520]/60 rounded-lg text-xs text-[#8899aa]">
          Your position is encrypted using Arcium privacy technology. 
          Your LP positions, deposit amounts, and trading activity are hidden from public view.
        </div>
      </AnimateHeight>

      <AnimateHeight open={enabled}>
        <FadeSlideIn show={enabled}>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#7ec8e8]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Encrypted with Arcium</span>
          </div>
        </FadeSlideIn>
      </AnimateHeight>
    </div>
  );
}
