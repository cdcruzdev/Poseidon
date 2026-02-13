"use client";

import { useMemo } from "react";

interface APRSparklineProps {
  data: number[]; // Array of APR values (last 7 days)
  width?: number;
  height?: number;
  color?: string;
  showTrend?: boolean;
}

// Generate mock historical data based on current APR
export function generateMockAPRHistory(currentAPR: number, days: number = 7): number[] {
  const data: number[] = [];
  let value = currentAPR * (0.85 + Math.random() * 0.15); // Start 85-100% of current
  
  for (let i = 0; i < days; i++) {
    // Random walk with drift toward current value
    const drift = (currentAPR - value) * 0.2;
    const volatility = currentAPR * 0.1 * (Math.random() - 0.5);
    value = Math.max(0, value + drift + volatility);
    data.push(value);
  }
  
  // Ensure last value is close to current
  data[days - 1] = currentAPR;
  
  return data;
}

export default function APRSparkline({
  data,
  width = 80,
  height = 24,
  color = "#7ec8e8",
  showTrend = true,
}: APRSparklineProps) {
  const { path, trend, trendPercent, minY, maxY, avgY } = useMemo(() => {
    if (!data.length) return { path: "", trend: "neutral", trendPercent: 0, minY: 0, maxY: 0, avgY: 0 };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const avg = data.reduce((a, b) => a + b, 0) / data.length;

    // Calculate trend
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trendDirection = avgSecond > avgFirst * 1.02 ? "up" : avgSecond < avgFirst * 0.98 ? "down" : "neutral";
    const trendPct = ((avgSecond - avgFirst) / avgFirst) * 100;

    // Generate SVG path
    const padding = 2;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
      return `${x},${y}`;
    });

    return {
      path: `M ${points.join(" L ")}`,
      trend: trendDirection,
      trendPercent: trendPct,
      minY: min,
      maxY: max,
      avgY: avg,
    };
  }, [data, width, height]);

  const trendColor = trend === "up" ? "#4ade80" : trend === "down" ? "#f87171" : color;

  return (
    <div className="relative group">
      <div className="flex items-center gap-2">
        <svg width={width} height={height} className="overflow-visible">
          {/* Gradient definition */}
          <defs>
            <linearGradient id={`sparkline-gradient-${color.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {path && (
            <path
              d={`${path} L ${width - 2},${height - 2} L 2,${height - 2} Z`}
              fill={`url(#sparkline-gradient-${color.replace("#", "")})`}
            />
          )}

          {/* Line */}
          {path && (
            <path
              d={path}
              fill="none"
              stroke={trendColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current value dot */}
          {data.length > 0 && (
            <circle
              cx={width - 2}
              cy={2 + (height - 4) - ((data[data.length - 1] - minY) / (maxY - minY || 1)) * (height - 4)}
              r="2.5"
              fill={trendColor}
            />
          )}
        </svg>

        {/* Trend indicator */}
        {showTrend && trend !== "neutral" && (
          <div className={`flex items-center text-[10px] font-medium ${
            trend === "up" ? "text-[#4ade80]" : "text-[#f87171]"
          }`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              {trend === "up" ? (
                <path d="M12 19V5M5 12l7-7 7 7" />
              ) : (
                <path d="M12 5v14M5 12l7 7 7-7" />
              )}
            </svg>
            <span>{Math.abs(trendPercent).toFixed(0)}%</span>
          </div>
        )}
      </div>

    </div>
  );
}
