import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";

/**
 * The organiser's venue layout (zones per ticket tier). Tapping opens the
 * full-size image so the legend stays readable on phones.
 */
export function EventVenueMap({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="space-y-4 md:space-y-6">
      <PremiumHeading level={2} dense className="text-foreground">
        Venue <span className="text-primary">Map</span>
      </PremiumHeading>

      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-[#1a0a1f] shadow-sm"
      >
        <Image
          src={src}
          alt={alt}
          width={1280}
          height={720}
          sizes="(min-width: 1024px) 66vw, 100vw"
          className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
        />
        {/* Icon-only on phones so it doesn't cover the legend */}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 p-2 text-xs font-semibold text-white backdrop-blur sm:bottom-3 sm:right-3 sm:px-3 sm:py-1.5">
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">View full size</span>
        </span>
      </a>
    </div>
  );
}
