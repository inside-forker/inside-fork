"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Calendar,
  MapPin,
  Smartphone,
} from "lucide-react";

import type { EventsTableProps } from "@/types/events.types";

export function EventsTable({
  events,
  isLoading,
  onEditEvent,
  onViewEvent,
  onDeleteEvent,
  currentPage,
  totalPages,
  onPageChange,
}: EventsTableProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState<
    Record<number, boolean>
  >({});

  // Prevent scroll lock when dropdown opens
  React.useEffect(() => {
    const hasOpenDropdown = Object.values(dropdownOpen).some(
      (isOpen) => isOpen,
    );

    if (hasOpenDropdown) {
      // Remove any scroll-lock attributes that Radix might add
      const body = document.body;
      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      // Remove immediately and set up observer to catch any future additions
      removeScrollLock();

      const observer = new MutationObserver(() => {
        if (body.hasAttribute("data-scroll-locked")) {
          removeScrollLock();
        }
      });

      observer.observe(body, {
        attributes: true,
        attributeFilter: ["data-scroll-locked", "style"],
      });

      return () => {
        observer.disconnect();
        removeScrollLock();
      };
    }
  }, [dropdownOpen]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const baseClasses =
      "text-xs font-medium px-2 py-1 rounded-full border backdrop-blur-sm shadow-sm transition-all duration-200 hover:shadow-md";

    switch (status) {
      case "published":
        return (
          <Badge
            className={`${baseClasses} bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 dark:border-green-500/40 hover:bg-green-500/15 hover:dark:bg-green-500/20`}
          >
            Published
          </Badge>
        );
      case "draft":
        return (
          <Badge
            className={`${baseClasses} bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30 dark:border-blue-500/40 hover:bg-blue-500/15 hover:dark:bg-blue-500/20`}
          >
            Draft
          </Badge>
        );
      case "archived":
        return (
          <Badge
            className={`${baseClasses} bg-gray-500/15 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30 dark:border-gray-500/40 hover:bg-gray-500/15 hover:dark:bg-gray-500/20`}
          >
            Archived
          </Badge>
        );
      default:
        return (
          <Badge
            className={`${baseClasses} bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted/50`}
          >
            {status}
          </Badge>
        );
    }
  };

  // Category-based subtle accent colors for styling
  const getCategoryColorScheme = (categoryId?: number | null) => {
    // Subtle accent colors that work with glass-card styling
    const schemes = [
      {
        glow: "hover:shadow-primary/10 dark:hover:shadow-primary/20",
        accent: "bg-primary/5 dark:bg-primary/10",
      },
      {
        glow: "hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20",
        accent: "bg-blue-500/5 dark:bg-blue-500/10",
      },
      {
        glow: "hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20",
        accent: "bg-purple-500/5 dark:bg-purple-500/10",
      },
      {
        glow: "hover:shadow-green-500/10 dark:hover:shadow-green-500/20",
        accent: "bg-green-500/5 dark:bg-green-500/10",
      },
      {
        glow: "hover:shadow-pink-500/10 dark:hover:shadow-pink-500/20",
        accent: "bg-pink-500/5 dark:bg-pink-500/10",
      },
    ];

    if (!categoryId) return schemes[0];
    return schemes[categoryId % schemes.length];
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3 },
    },
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[600px] auto-rows-fr items-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-muted rounded-lg" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-6 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-16" />
              <div className="h-4 bg-muted rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[600px]">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No events found</h3>
        <p className="text-muted-foreground text-center">
          No events match the current filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr min-h-[600px] items-start">
        {events.map((event) => {
          const colorScheme = getCategoryColorScheme(event.category_id);

          return (
            <motion.div
              key={event.event_id}
              variants={itemVariants}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Card
                className={`group relative overflow-hidden flex flex-col h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300 ${colorScheme.glow}`}
              >
                {/* Subtle hover background - optimized for less blur */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <CardHeader className="pb-3 relative z-10 flex-shrink-0 min-h-[80px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base leading-tight truncate pr-2 text-foreground group-hover:text-primary transition-colors duration-300">
                          {event.event_name}
                        </h3>
                        {event.event_description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                            {event.event_description}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu
                      open={dropdownOpen[event.event_id] || false}
                      onOpenChange={(open) =>
                        setDropdownOpen((prev) => ({
                          ...prev,
                          [event.event_id]: open,
                        }))
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-shrink-0 relative z-10 hover:bg-primary/10"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-48 bg-background/95 backdrop-blur-md shadow-premium border-border/60 rounded-xl"
                        align="end"
                        sideOffset={4}
                        alignOffset={-4}
                      >
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/2 rounded-xl pointer-events-none" />

                        <div className="relative z-10 p-2">
                          <DropdownMenuItem
                            onClick={() => onEditEvent(event)}
                            className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Event
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/admin/events/${event.event_id}/device-allocation`;
                            }}
                            className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                          >
                            <Smartphone className="h-4 w-4 mr-2 text-primary" />
                            Device Allocation & Staff
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onViewEvent(event)}
                            className="cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors duration-200"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteEvent(event)}
                            className="cursor-pointer text-red-600 focus:text-red-600 hover:bg-red-500/10 focus:bg-red-500/10 transition-colors duration-200"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Event
                          </DropdownMenuItem>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between space-y-3 relative z-10">
                  {/* Date & Time - Most important information */}
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-muted/50 rounded-md">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {formatDate(event.start_time)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Date & Time
                      </p>
                    </div>
                  </div>

                  {/* Venue - Where the event is happening */}
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-muted/50 rounded-md">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {event.location_name || "Location TBD"}
                      </span>
                      <p className="text-xs text-muted-foreground">Location</p>
                    </div>
                  </div>

                  {/* Organizer - Who is organizing */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-7 w-7 ring-2 ring-background/50">
                        <AvatarImage src={event.organizer_avatar || ""} />
                        <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                          {event.organizer_name?.charAt(0)?.toUpperCase() ||
                            "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {event.organizer_name || "Unknown Organizer"}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Organizer
                        </p>
                      </div>
                    </div>
                    {/* Status and Featured Badges - Grouped together */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {event.is_featured && (
                        <Badge className="text-xs font-medium px-2 py-1 bg-yellow-500/20 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/40 dark:border-yellow-500/30 backdrop-blur-sm shadow-sm">
                          Featured
                        </Badge>
                      )}
                      {getStatusBadge(event.event_status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {events.length} events
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
