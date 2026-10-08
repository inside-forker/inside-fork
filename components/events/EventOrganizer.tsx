"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Verified, Phone, Globe } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EventOrganizerProps } from "@/types/events.types";
import Link from "next/link";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

interface OrganizerStats {
  eventsOrganized: number;
  totalAttendees: number;
  upcomingEvents: number;
}

interface OrganizerItem {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  isVerified: boolean;
  bio: string | null;
  company: string | null;
  website: string | null;
  stats: OrganizerStats;
  recentEvents: RecentEvent[];
}

interface RecentEvent {
  id: number;
  name: string;
  slug: string;
  start_time: string;
  end_time: string;
}

export function EventOrganizer({ event }: EventOrganizerProps) {
  const [organizers, setOrganizers] = React.useState<OrganizerItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    if (!event.id && !event.organizer_id) return;

    const endpoint = event.id
      ? `/api/events/${event.id}/organizers`
      : `/api/organizer/${event.organizer_id}/stats`;

    fetch(endpoint)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (Array.isArray(data.organizers)) {
            setOrganizers(data.organizers);
          } else if (data.data?.organizer) {
            setOrganizers([
              {
                ...data.data.organizer,
                stats: data.data.stats || {
                  eventsOrganized: 0,
                  totalAttendees: 0,
                  upcomingEvents: 0,
                },
                recentEvents: data.data.recentEvents || [],
              },
            ]);
          }
        } else {
          setHasError(true);
        }
      })
      .catch((error) => {
        console.error("Error fetching event organizers:", error);
        setHasError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [event.id, event.organizer_id]);

  if (!event.organizer_name && organizers.length === 0 && !isLoading) {
    return null;
  }

  // Show minimal card if there's an error fetching organizer data (e.g., admin/lister)
  if (hasError && !isLoading && organizers.length === 0) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center">
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Event <span className="text-primary">Organizer</span>
            </PremiumHeading>
          </div>
        </div>
        <Card className="group relative overflow-hidden bg-card border rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 md:h-20 md:w-20 border-4 border-primary/20">
              <AvatarImage src={event.organizer_avatar || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl md:text-2xl font-bold">
                {event.organizer_name ? event.organizer_name.charAt(0).toUpperCase() : "O"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg md:text-xl font-bold">
                {event.organizer_name || "Event Organizer"}
              </h3>
              <p className="text-muted-foreground text-sm">Event Organizer</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center">
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Event <span className="text-primary">Organizer</span>
            </PremiumHeading>
          </div>
        </div>
        <Card className="group relative overflow-hidden bg-card border rounded-2xl p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Avatar Skeleton */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 lg:flex-col lg:items-center lg:min-w-[200px]">
              <Skeleton className="h-24 w-24 md:h-32 md:w-32 rounded-full" />
              <div className="text-center sm:text-left lg:text-center space-y-3 w-full">
                <Skeleton className="h-6 w-32 mx-auto sm:mx-0 lg:mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto sm:mx-0 lg:mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto sm:mx-0 lg:mx-auto" />
              </div>
            </div>
            {/* Stats Skeleton */}
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 bg-card rounded-xl border border-border/30"
                  >
                    <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    <Skeleton className="h-3 w-20 mx-auto" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const isMultiOrganizer = organizers.length > 1;

  return (
    <motion.div
      className="space-y-4 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Section Header */}
      <div className="flex items-center">
        <div>
          <PremiumHeading level={2} dense className="text-foreground">
            Event <span className="text-primary">{isMultiOrganizer ? "Organizers" : "Organizer"}</span>
          </PremiumHeading>
        </div>
      </div>

      {/* Organizer Cards List */}
      <div className="space-y-4 md:space-y-6">
        {organizers.map((organizer) => {
          const orgName = organizer.full_name || organizer.username || "Organizer";
          return (
            <Card
              key={organizer.id}
              className="group relative overflow-hidden bg-card border rounded-2xl p-4 md:p-8 hover:border-primary/40 transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
                {/* Organizer Avatar & Basic Info */}
                <div className="flex flex-row items-center sm:items-start gap-4 lg:flex-col lg:items-center lg:min-w-[200px]">
                  <div className="relative shrink-0">
                    <Avatar className="h-16 w-16 sm:h-24 sm:w-24 md:h-32 md:w-32 border-4 border-primary/20">
                      <AvatarImage src={organizer.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl md:text-3xl font-bold">
                        {orgName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {organizer.isVerified && (
                      <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-primary text-primary-foreground rounded-full p-1.5 sm:p-2">
                        <Verified className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 text-left lg:text-center">
                    <div className="flex flex-wrap items-center justify-start lg:justify-center gap-x-2 gap-y-1 mb-1 md:mb-2">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold">
                        {orgName}
                      </h3>
                      {organizer.isVerified && (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary border-primary/20"
                        >
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm md:text-base text-muted-foreground md:mb-3">
                      {organizer.company || "Event Organizer"}
                    </p>
                  </div>
                </div>

                {/* Organizer Stats & Details */}
                <div className="flex-1 space-y-4 md:space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <div className="text-center p-2.5 md:p-4 bg-muted/30 rounded-xl">
                      <div className="text-xl md:text-3xl font-bold text-primary mb-0.5 md:mb-1">
                        {organizer.stats?.eventsOrganized ?? 0}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">
                        Events Organized
                      </div>
                    </div>

                    <div className="text-center p-2.5 md:p-4 bg-muted/30 rounded-xl">
                      <div className="text-xl md:text-3xl font-bold text-primary mb-0.5 md:mb-1">
                        {(organizer.stats?.totalAttendees ?? 0).toLocaleString()}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">
                        Total Attendees
                      </div>
                    </div>

                    <div className="text-center p-2.5 md:p-4 bg-muted/30 rounded-xl">
                      <div className="text-xl md:text-3xl font-bold text-primary mb-0.5 md:mb-1">
                        {organizer.stats?.upcomingEvents ?? 0}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">
                        Upcoming Events
                      </div>
                    </div>
                  </div>

                  {/* About Organizer */}
                  {organizer.bio && (
                    <div className="space-y-1.5 md:space-y-4">
                      <h4 className="text-base md:text-lg font-semibold">About the Organizer</h4>
                      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                        {organizer.bio}
                      </p>
                    </div>
                  )}

                  {/* Previous Events Preview */}
                  {organizer.recentEvents && organizer.recentEvents.length > 0 && (
                    <div className="space-y-2 md:space-y-4">
                      <h4 className="text-base md:text-lg font-semibold">Recent Events</h4>
                      <div className="space-y-2 md:space-y-3">
                        {organizer.recentEvents.map((pastEvent) => (
                          <Link
                            key={pastEvent.id}
                            href={`/events/${pastEvent.slug}`}
                            className="block"
                          >
                            <div className="flex items-center justify-between p-3 bg-muted/40 dark:bg-muted/20 rounded-lg hover:bg-muted/60 transition-colors">
                              <div>
                                <div className="font-medium">{pastEvent.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(
                                    pastEvent.start_time,
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 md:pt-4">
                    {organizer.phone && organizer.role === "organizer" && (
                      <Button
                        variant="outline"
                        className="flex-1 border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                        asChild
                      >
                        <a href={`tel:${organizer.phone}`}>
                          <Phone className="w-4 h-4 mr-2" />
                          Contact Organizer
                        </a>
                      </Button>
                    )}

                    {organizer.username && organizer.role === "organizer" && (
                      <Button
                        variant="outline"
                        className="flex-1 border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                        asChild
                      >
                        <Link href={`/organizer/${organizer.username}`}>
                          <Calendar className="w-4 h-4 mr-2" />
                          View All Events
                        </Link>
                      </Button>
                    )}

                    {organizer.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="sm:w-auto border-primary/20 hover:bg-primary/5 dark:hover:bg-primary/10"
                        asChild
                      >
                        <a
                          href={organizer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
