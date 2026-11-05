"use client";

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * The organiser's venue layout (zones per ticket tier). Tapping opens the
 * full-size image in a lightbox so the legend stays readable on phones.
 */
export function EventVenueMap({ src, alt }: { src: string; alt: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="relative block w-full overflow-hidden rounded-[20px] bg-muted text-left"
        >
          <Image
            src={src}
            alt={alt}
            width={1280}
            height={720}
            sizes="(min-width: 1024px) 720px, 100vw"
            className="h-auto w-full"
          />
          <span className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-3 text-xs font-semibold text-foreground shadow-sm">
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">View full size</span>
            <span className="sr-only sm:hidden">View full size</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none sm:max-w-5xl [&>button]:right-2 [&>button]:top-2 [&>button]:rounded-full [&>button]:bg-background [&>button]:p-2 [&>button]:text-foreground [&>button]:opacity-100">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <Image
          src={src}
          alt={alt}
          width={1920}
          height={1080}
          sizes="95vw"
          className="h-auto max-h-[90vh] w-full rounded-xl object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
