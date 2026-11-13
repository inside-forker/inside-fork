import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the event page: phones show the banner on its ink strip, then the
 * day tabs and ticket rows; desktop shows the banner beside the sidebar.
 */
export default function EventLoading() {
  return (
    <div className="bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 pt-3 md:px-8 lg:max-w-[1200px] lg:pt-7">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10">
          <div>
            <div className="overflow-hidden rounded-media bg-muted">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 px-3.5 pb-3.5 pt-3 lg:hidden">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="mt-4 lg:hidden">
              <Skeleton className="h-11 w-full rounded-full" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border py-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-9 w-28 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-3 h-9 w-3/4" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-6 h-6 w-24" />
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mt-3 h-12 w-full rounded-media" />
            ))}
            <Skeleton className="mt-6 h-[52px] w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
