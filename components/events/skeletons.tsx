import { Skeleton } from "@/components/ui/skeleton";

export function TicketSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <Skeleton className="h-10 w-10 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

export function SimilarEventsSkeleton() {
  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export function EventSidebarSkeleton() {
  return (
    <div className="sticky top-8">
      <div className="relative overflow-hidden bg-card border rounded-2xl p-6 md:p-8 space-y-6 animate-pulse">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
          <div>
            <Skeleton className="h-5 w-20 mb-2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-1" />
          </div>
          <div>
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
