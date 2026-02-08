"use client";

import { useState, useEffect } from "react";

export default function AgentHealthBar() {
  const [pulse, setPulse] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  // Simulate uptime counter
  useEffect(() => {
    const startTime = Date.now() - 847200000; // ~9.8 days ago
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(false);
      setTimeout(() => setPulse(true), 200);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const days = Math.floor(elapsed / 86400000);
  const hours = Math.floor((elapsed % 86400000) / 3600000);
  const mins = Math.floor((elapsed % 3600000) / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className="bg-[#0a1520]/60 backdrop-blur-sm rounded-full border border-[#1a3050] px-4 py-2 flex items-center gap-3 max-w-fit mx-auto mb-6">
      {/* Heartbeat */}
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <div
            className={`w-2 h-2 rounded-full bg-[#4ade80] transition-transform duration-200 ${
              pulse ? "scale-100" : "scale-150 opacity-50"
            }`}
          />
          {pulse && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#4ade80] animate-ping opacity-30" />
          )}
        </div>
        <span className="text-xs font-semibold text-[#4ade80]">LIVE</span>
      </div>

      <div className="w-px h-4 bg-[#1a3050]" />

      {/* Status */}
      <span className="text-xs text-[#8899aa]">Agent Online</span>

      <div className="w-px h-4 bg-[#1a3050]" />

      {/* Uptime */}
      <span className="text-xs font-mono text-[#5a7090]">
        {days}d {hours}h {mins}m {secs}s
      </span>

      <div className="w-px h-4 bg-[#1a3050]" />

      {/* Positions monitored */}
      <div className="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className="text-xs text-[#5a7090]">3 positions</span>
      </div>

      <div className="w-px h-4 bg-[#1a3050]" />

      {/* Next scan */}
      <div className="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className="text-xs text-[#5a7090]">Next scan 2m</span>
      </div>
    </div>
  );
}
