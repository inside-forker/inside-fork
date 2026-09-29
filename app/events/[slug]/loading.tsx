import { Skeleton } from "@/components/ui/skeleton";

export default function EventLoading() {
    return (
        <div className="min-h-screen bg-background">
            {/* Hero Skeleton (Matches EventHero) */}
            <div className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh] overflow-hidden">
                <Skeleton className="absolute inset-0" />

                {/* Hero Content Information Skeleton */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-12">
                    <div className="container mx-auto">
                        <div className="max-w-4xl space-y-6">
                            {/* Badge */}
                            <Skeleton className="h-8 w-32 bg-muted/60 rounded-full" />

                            {/* Title */}
                            <div className="space-y-2">
                                <Skeleton className="h-10 md:h-14 lg:h-16 w-3/4 max-w-3xl bg-muted/60" />
                                <Skeleton className="h-10 md:h-14 lg:h-16 w-1/2 max-w-2xl bg-muted/60" />
                            </div>

                            {/* Date/Location Info */}
                            <div className="flex flex-wrap gap-4 pt-2">
                                <Skeleton className="h-6 w-48 bg-muted/60" />
                                <Skeleton className="h-6 w-48 bg-muted/60" />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-3 pt-4">
                                <Skeleton className="h-12 w-40 rounded-xl bg-muted/60" />
                                <Skeleton className="h-12 w-40 rounded-xl bg-muted/60" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content (Matches 2-column layout) */}
            <div className="container mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 md:gap-16 lg:gap-20">

                    {/* Left Column - Main Info */}
                    <div className="lg:col-span-2 space-y-12 md:space-y-16">

                        {/* Description Skeleton */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3">
                                <Skeleton className="h-12 w-12 rounded-2xl" />
                                <Skeleton className="h-8 w-48" />
                            </div>
                            <div className="space-y-3">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        </div>

                        {/* Gallery Skeleton */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3">
                                <Skeleton className="h-8 w-40" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <Skeleton className="aspect-video rounded-xl" />
                                <Skeleton className="aspect-video rounded-xl" />
                                <Skeleton className="aspect-video rounded-xl" />
                            </div>
                        </div>

                        {/* Ticket Skeleton */}
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3">
                                <Skeleton className="h-8 w-32" />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <Skeleton className="h-32 rounded-xl" />
                                <Skeleton className="h-32 rounded-xl" />
                            </div>
                        </div>

                        {/* Organizer Skeleton */}
                        <div className="space-y-6">
                            <Skeleton className="h-24 w-full rounded-2xl" />
                        </div>

                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-8">
                        <div className="sticky top-8">
                            {/* Event Information Card Skeleton */}
                            <Skeleton className="h-[500px] w-full rounded-2xl" />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
