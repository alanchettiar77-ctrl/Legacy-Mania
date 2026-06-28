export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="w-10 h-10 bg-muted animate-pulse rounded-xl" />
            <div className="h-7 w-16 bg-muted animate-pulse rounded" />
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-14 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
