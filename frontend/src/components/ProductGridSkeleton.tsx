/** Placeholder cards that hold the grid's shape while products load. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[6px] border border-hairline bg-paper"
        >
          <div className="aspect-square w-full animate-pulse bg-shell" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-shell" />
            <div className="h-3 w-full animate-pulse rounded bg-shell" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-shell" />
          </div>
        </div>
      ))}
    </div>
  );
}
