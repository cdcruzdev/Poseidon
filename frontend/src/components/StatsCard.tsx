interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon?: React.ReactNode;
}

export default function StatsCard({
  title,
  value,
  change,
  changePositive,
  icon,
}: StatsCardProps) {
  return (
    <div className="bg-[#0a1520] border border-[#1a3050] rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#5a7090] text-sm mb-2">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {change && (
            <p
              className={`text-sm mt-1 ${
                changePositive ? "text-[#4ade80]" : "text-[#f87171]"
              }`}
            >
              {changePositive ? "+" : ""}{change}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-lg bg-[#1a3050] flex items-center justify-center text-[#5eead4]">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
