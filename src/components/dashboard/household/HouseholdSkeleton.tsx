import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** Streaming fallback while the household net worth loads. */
export default function HouseholdSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8" aria-busy="true">
      <span className="sr-only">Loading household net worth</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Card className="space-y-4 p-5 md:p-7">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-14 w-72 max-w-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-2.5 w-full" />
      </Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <SkeletonText lines={4} />
      </Card>
    </div>
  );
}
