"use client";

import { useState, useEffect } from "react";

interface StatItem {
  label: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
}

// Animated counter hook
function useAnimatedNumber(target: number, duration: number = 1000): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = value;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startValue + (target - startValue) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

function AnimatedStat({ value, suffix = "" }: { value: number; suffix?: string }) {
  const animated = useAnimatedNumber(value, 1500);
  return <>{animated.toLocaleString(undefined, { maximumFractionDigits: 0 })}{suffix}</>;
}

export default function StatsBar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stats: StatItem[] = [
    {
      label: "Total Value Locked",
      value: "$2.4M",
      change: 12.5,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7ec8e8" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ),
    },
    {
      label: "24h Volume",
      value: "$847K",
      change: 8.3,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
          <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
          <polyline points="16,7 22,7 22,13" />
        </svg>
      ),
    },
    {
      label: "Active Positions",
      value: "1,247",
      change: 3.2,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      label: "Pools Indexed",
      value: "328",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      label: "Avg APR",
      value: "42.3%",
      change: -2.1,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full bg-[#0a1520]/80 backdrop-blur-sm border-b border-[#1a3050]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 overflow-x-auto scrollbar-hide">
          {/* Stats */}
          <div className="flex items-center gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 whitespace-nowrap"
                style={{
                  animation: mounted ? `fadeInUp 0.5s ease-out ${index * 0.1}s both` : "none",
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#1a3050]/50 flex items-center justify-center">
                  {stat.icon}
                </div>
                <div>
                  <div className="text-xs text-[#5a7090]">{stat.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-[#e0e8f0]">
                      {mounted && stat.label === "Active Positions" ? (
                        <AnimatedStat value={1247} />
                      ) : mounted && stat.label === "Pools Indexed" ? (
                        <AnimatedStat value={328} />
                      ) : (
                        stat.value
                      )}
                    </span>
                    {stat.change !== undefined && (
                      <span
                        className={`text-xs flex items-center gap-0.5 ${
                          stat.change >= 0 ? "text-[#4ade80]" : "text-[#f87171]"
                        }`}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          {stat.change >= 0 ? (
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          ) : (
                            <path d="M12 5v14M5 12l7 7 7-7" />
                          )}
                        </svg>
                        {Math.abs(stat.change)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DEX Logos */}
          <div className="hidden lg:flex items-center gap-3 pl-6 border-l border-[#1a3050]">
            <span className="text-xs text-[#5a7090]">Powered by</span>
            <div className="flex items-center gap-2">
              {["meteora", "orca", "raydium"].map((dex) => (
                <div
                  key={dex}
                  className="w-7 h-7 rounded-lg bg-[#1a3050]/50 flex items-center justify-center text-xs font-bold text-[#7ec8e8] uppercase"
                  title={dex}
                >
                  {dex[0]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
