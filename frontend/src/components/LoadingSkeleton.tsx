interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[#1a3050] rounded ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-[#0a1520]/90 backdrop-blur-md rounded-2xl border border-[#1a3050] p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function PoolResultSkeleton() {
  return (
    <div className="bg-[#0d1d30]/80 rounded-xl border border-[#1a3050] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Skeleton className="h-3 w-8 mb-1" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-8 mb-1" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-8 mb-1" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

export function PositionCardSkeleton() {
  return (
    <div className="bg-[#0a1520]/90 backdrop-blur-md rounded-2xl border border-[#1a3050] p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <div>
            <Skeleton className="h-5 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#0a1520]/90 rounded-xl border border-[#1a3050] p-4">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}
