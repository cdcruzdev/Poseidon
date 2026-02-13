"use client";

export default function LiveActivityFeed() {
  return (
    <div className="bg-[#0d1d30]/60 rounded-xl border border-[#1a3050] overflow-hidden">
      <div className="p-3 border-b border-[#1a3050] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
        <span className="text-sm font-medium text-[#e0e8f0]">Live Activity</span>
      </div>

      <div className="p-8 text-center">
        <p className="text-sm text-[#8899aa]">
          Activity will appear here as deposits and rebalances occur.
        </p>
      </div>
    </div>
  );
}
