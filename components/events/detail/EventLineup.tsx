import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** One performer, in billing order (same shape as the app's `lineup`). */
export interface EventLineupArtist {
  name: string;
  tag: string | null;
  photo_url: string | null;
}

/** Ink card with the lineup set large. Nothing renders without artists. */
export function EventLineup({ artists, className }: { artists: EventLineupArtist[]; className?: string }) {
  if (artists.length === 0) return null;

  return (
    <section
      aria-labelledby="lineup-title"
      className={cn(
        "rounded-3xl bg-foreground px-[22px] pb-7 pt-6 text-background lg:rounded-[28px] lg:px-10 lg:pb-10 lg:pt-9",
        className,
      )}
    >
      <h2
        id="lineup-title"
        className="text-[13px] font-semibold uppercase tracking-[0.06em] text-background/65"
      >
        Lineup
      </h2>
      <p className="mt-5 text-[26px] font-bold leading-[1.2] tracking-[-0.02em] lg:mt-7 lg:text-[32px] lg:leading-[1.18] lg:tracking-[-0.025em]">
        {artists.map((artist, i) => (
          <Fragment key={`${artist.name}-${i}`}>
            {i > 0 && (
              <span className="text-background/30" aria-hidden="true">
                {" · "}
              </span>
            )}
            {artist.name}
          </Fragment>
        ))}
      </p>
    </section>
  );
}
