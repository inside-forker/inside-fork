import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search, ArrowLeft } from "lucide-react";

/**
 * Lightweight static 404. Bots and bad URLs hit this often — keep it free of
 * framer-motion / client mount gates so Active CPU stays near zero.
 */
export default function NotFound() {
  return (
    <div
      data-nextjs-not-found
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center"
    >
      <p className="text-6xl sm:text-8xl font-bold tracking-tighter text-primary/80">
        404
      </p>
      <h1 className="mt-4 text-2xl sm:text-3xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground text-base sm:text-lg">
        This page doesn&apos;t exist or may have moved. Head home or browse
        listings to keep exploring Karachi.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 items-center justify-center">
        <Button asChild size="lg">
          <Link href="/" className="inline-flex items-center gap-2">
            <Home className="h-4 w-4" />
            Home
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/listings" className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            Explore listings
          </Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/listings" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Browse
          </Link>
        </Button>
      </div>
    </div>
  );
}
