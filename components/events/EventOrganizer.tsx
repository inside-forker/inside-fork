"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EventOrganizerProps } from "@/types/events.types";
import { cn } from "@/lib/utils";

interface OrganizerItem {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  role: string;
  isVerified: boolean;
}

/**
 * Organizer byline under the event title: avatar and name(s), each name
 * linking to the organizer's page when they have one. Renders from the event
 * row straight away, then fills in links once the organizers load.
 */
export function EventOrganizer({
  event,
  className,
}: EventOrganizerProps & { className?: string }) {
  const [organizers, setOrganizers] = React.useState<OrganizerItem[]>([]);

  React.useEffect(() => {
    if (!event.id && !event.organizer_id) return;

    const endpoint = event.id
      ? `/api/events/${event.id}/organizers`
      : `/api/organizer/${event.organizer_id}/stats`;

    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        if (Array.isArray(data.organizers)) {
          setOrganizers(data.organizers);
        } else if (data.data?.organizer) {
          setOrganizers([data.data.organizer]);
        }
      })
      .catch((error) => {
        console.error("Error fetching event organizers:", error);
      });
  }, [event.id, event.organizer_id]);

  // Until the lookup lands (or when it fails, e.g. admin/lister events), the
  // name and avatar the event row already carries.
  const people: OrganizerItem[] =
    organizers.length > 0
      ? organizers
      : event.organizer_name
        ? [
            {
              id: "event-organizer",
              full_name: event.organizer_name,
              avatar_url: event.organizer_avatar || null,
              username: null,
              role: "",
              isVerified: false,
            },
          ]
        : [];

  if (people.length === 0) return <div className={className} />;

  const lead = people[0];
  const leadName = lead.full_name || lead.username || "Organizer";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 text-[15px] text-muted-foreground lg:text-[17px]",
        className,
      )}
    >
      <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border">
        <AvatarImage src={lead.avatar_url || undefined} alt="" />
        <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
          {leadName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">
        {people.map((organizer, i) => {
          const name = organizer.full_name || organizer.username || "Organizer";
          const href =
            organizer.username && organizer.role === "organizer"
              ? `/organizer/${organizer.username}`
              : null;
          return (
            <React.Fragment key={organizer.id}>
              {i > 0 && (i === people.length - 1 ? " & " : ", ")}
              {href ? (
                <Link href={href} className="hover:text-foreground hover:underline">
                  {name}
                </Link>
              ) : (
                name
              )}
            </React.Fragment>
          );
        })}
      </span>
      {people.length === 1 && lead.isVerified && (
        <BadgeCheck className="h-4 w-4 shrink-0 text-foreground" aria-label="Verified organizer" />
      )}
    </div>
  );
}
