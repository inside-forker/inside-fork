import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the event page: poster, title, facts strip, ticket tiles; desktop adds the Tickets card. */
export default function EventLoading() {
  return (
    <div className="bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 pt-3 md:px-8 lg:max-w-[1200px] lg:pt-12">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,400px)] lg:gap-x-14">
          <div className="hidden lg:col-span-2 lg:block">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="mt-4 h-5 w-56" />
          </div>

          <div className="lg:mt-8">
            <Skeleton className="aspect-video w-full rounded-2xl lg:rounded-3xl" />
            <div className="mt-5 lg:hidden">
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="mt-3 h-5 w-48" />
            </div>
            <div className="mt-7 grid grid-cols-3 gap-4 lg:mt-9">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-7 w-20 lg:h-8" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-11 lg:mt-8 lg:rounded-[28px] lg:p-6 lg:ring-1 lg:ring-inset lg:ring-border">
            <Skeleton className="h-7 w-28" />
            <div className="mt-4 grid grid-cols-2 gap-2.5 lg:mt-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[184px] rounded-[20px]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
