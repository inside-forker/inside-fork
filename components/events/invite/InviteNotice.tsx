import type { ReactNode } from "react";
import { Container, Heading, Label, Section } from "@/components/ds";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatEventWhen } from "@/lib/events/datetime";

/**
 * The one screen every invite state uses: poster, event, one line of copy and
 * one action. Cream band, nothing else on the page.
 */
export function InviteNotice({
  title,
  body,
  event,
  action,
}: {
  title: string;
  body: string;
  event?: { name: string; start_time: string; location_name: string | null; poster: string | null };
  action?: ReactNode;
}) {
  const meta = event
    ? [formatEventWhen(event.start_time), event.location_name].filter(Boolean).join(" · ")
    : null;

  return (
    <Section tone="cream" size="md" className="min-h-[70vh] font-ui">
      <Container width="prose" className="flex flex-col items-center text-center">
        {event?.poster && (
          <div className="mb-10 w-full max-w-xs overflow-hidden rounded-media bg-muted">
            <OptimizedImage
              src={event.poster}
              alt={event.name}
              width={800}
              height={1000}
              sizes="320px"
              className="block h-auto w-full object-contain"
            />
          </div>
        )}
        {event && <Label as="p">You&apos;re invited to {event.name}</Label>}
        <Heading as="h1" variant="display-md" className="mt-3">
          {title}
        </Heading>
        {meta && <Label as="p" className="mt-4 text-muted-foreground">{meta}</Label>}
        <p className="mt-6 max-w-md text-body text-muted-foreground">{body}</p>
        {action && <div className="mt-10 w-full max-w-xs">{action}</div>}
      </Container>
    </Section>
  );
}
