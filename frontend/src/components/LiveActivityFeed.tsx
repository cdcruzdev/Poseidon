"use client";

import { useState, useEffect, useCallback } from "react";

interface Activity {
  id: string;
  type: "deposit" | "withdraw" | "rebalance";
  dex: string;
  pair: string;
  amount: number;
  wallet: string;
  timestamp: Date;
}

// Simulated activity generator
function generateActivity(): Activity {
  const types: ("deposit" | "withdraw" | "rebalance")[] = ["deposit", "deposit", "deposit", "withdraw", "rebalance"];
  const dexes = ["Meteora", "Orca", "Raydium"];
  const pairs = ["SOL-USDC", "JUP-USDC", "BONK-SOL", "JitoSOL-SOL", "cbBTC-USDC", "WIF-SOL", "PYTH-USDC"];
  
  // Generate realistic-looking wallet address
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let wallet = "";
  for (let i = 0; i < 44; i++) {
    wallet += chars[Math.floor(Math.random() * chars.length)];
  }

  // Generate amount based on type
  const baseAmount = Math.random() * 10000 + 100;
  const type = types[Math.floor(Math.random() * types.length)];

  return {
    id: Math.random().toString(36).substr(2, 9),
    type,
    dex: dexes[Math.floor(Math.random() * dexes.length)],
    pair: pairs[Math.floor(Math.random() * pairs.length)],
    amount: type === "rebalance" ? baseAmount * 0.3 : baseAmount,
    wallet,
    timestamp: new Date(),
  };
}

const typeConfig = {
  deposit: {
    icon: "↓",
    color: "#4ade80",
    bgColor: "rgba(74, 222, 128, 0.1)",
    label: "Deposited",
  },
  withdraw: {
    icon: "↑",
    color: "#f87171",
    bgColor: "rgba(248, 113, 113, 0.1)",
    label: "Withdrew",
  },
  rebalance: {
    icon: "⟲",
    color: "#7ec8e8",
    bgColor: "rgba(126, 200, 232, 0.1)",
    label: "Rebalanced",
  },
};

interface LiveActivityFeedProps {
  maxItems?: number;
  autoGenerate?: boolean;
  interval?: number;
}

export default function LiveActivityFeed({
  maxItems = 5,
  autoGenerate = true,
  interval = 5000,
}: LiveActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newItemId, setNewItemId] = useState<string | null>(null);

  const addActivity = useCallback((activity: Activity) => {
    setNewItemId(activity.id);
    setActivities((prev) => [activity, ...prev].slice(0, maxItems));
    
    // Clear the "new" animation after a delay
    setTimeout(() => setNewItemId(null), 500);
  }, [maxItems]);

  // Auto-generate activities for demo
  useEffect(() => {
    if (!autoGenerate) return;

    // Generate initial activities
    const initial = Array.from({ length: 3 }, () => generateActivity());
    initial.forEach((a, i) => {
      a.timestamp = new Date(Date.now() - i * 30000);
    });
    setActivities(initial);

    // Add new activities periodically
    const timer = setInterval(() => {
      addActivity(generateActivity());
    }, interval + Math.random() * 3000);

    return () => clearInterval(timer);
  }, [autoGenerate, interval, addActivity]);

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const formatTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="bg-[#0d1d30]/60 rounded-xl border border-[#1a3050] overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[#1a3050] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
          <span className="text-sm font-medium text-[#e0e8f0]">Live Activity</span>
        </div>
        <span className="text-xs text-[#5a7090]">Last 24h</span>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-[#1a3050]/50">
        {activities.map((activity) => {
          const config = typeConfig[activity.type];
          const isNew = activity.id === newItemId;

          return (
            <div
              key={activity.id}
              className={`p-3 flex items-center gap-3 transition-all duration-500 ${
                isNew ? "bg-[#7ec8e8]/10 animate-pulse" : ""
              }`}
            >
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: config.bgColor, color: config.color }}
              >
                {config.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#e0e8f0]">{config.label}</span>
                  <span className="text-sm font-bold" style={{ color: config.color }}>
                    {formatAmount(activity.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#5a7090]">
                  <span>{activity.pair}</span>
                  <span>•</span>
                  <span className="text-[#7ec8e8]">{activity.dex}</span>
                </div>
              </div>

              {/* Wallet & Time */}
              <div className="text-right">
                <div className="text-xs text-[#8899aa] font-mono">
                  {formatWallet(activity.wallet)}
                </div>
                <div className="text-xs text-[#5a7090]">
                  {formatTime(activity.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-[#1a3050] bg-[#0a1520]/30">
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[#5a7090]">24h Volume: </span>
              <span className="text-[#7ec8e8] font-medium">$2.4M</span>
            </div>
            <div>
              <span className="text-[#5a7090]">Active LPs: </span>
              <span className="text-[#4ade80] font-medium">847</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
            <span className="text-[#4ade80]">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
