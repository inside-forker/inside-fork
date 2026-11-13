import Image from "next/image";
import Link from "next/link";
import type { EventBanner } from "@/lib/events/list";
import { cn } from "@/lib/utils";

/**
 * An event as its banner: the whole image in its own shape, never cropped,
 * with the details as white text straight on it. Name and date sit bottom
 * left, the price bottom right.
 *
 * `wall` grows the text from lg for the /events wall; `compact` keeps it
 * small for narrower spots such as "More events".
 */
export function EventBannerCard({
  href,
  name,
  dateLabel,
  priceLabel,
  banner,
  sizes,
  priority = false,
  variant = "compact",
  className,
}: {
  href: string;
  name: string;
  dateLabel: string;
  priceLabel: string | null;
  banner: EventBanner | null;
  sizes: string;
  priority?: boolean;
  variant?: "compact" | "wall";
  className?: string;
}) {
  const wall = variant === "wall";

  return (
    <Link
      href={href}
      aria-label={[name, dateLabel, priceLabel].filter(Boolean).join(", ")}
      className={cn("group relative block overflow-hidden rounded-media bg-muted text-white", className)}
    >
      {banner ? (
        <Image
          src={banner.url}
          alt=""
          width={banner.width}
          height={banner.height}
          sizes={sizes}
          priority={priority}
          className="block h-auto w-full transition-transform duration-slow ease-standard group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div className="aspect-video bg-ink" />
      )}

      <span
        aria-hidden="true"
        className={cn(
          "text-on-image pointer-events-none absolute inset-x-3.5 bottom-3",
          wall && "lg:inset-x-[18px] lg:bottom-4",
        )}
      >
        <span
          className={cn(
            "block truncate text-body font-bold leading-tight tracking-[-0.01em]",
            wall && "lg:text-xl lg:leading-tight",
          )}
        >
          {name}
        </span>
        <span className="mt-0.5 flex items-baseline justify-between gap-3 whitespace-nowrap">
          <span className={cn("truncate text-data font-medium", wall && "lg:text-small")}>{dateLabel}</span>
          {priceLabel && (
            <span className={cn("shrink-0 text-small font-bold", wall && "lg:text-[15px]")}>{priceLabel}</span>
          )}
        </span>
      </span>
    </Link>
  );
}
