"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Ticket,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  Download,
  Eye,
  Edit2,
  RefreshCw,
  Radio,
  MapPin,
  ScanLine,
  Users,
  Activity,
  Plus,
  SlidersHorizontal,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { SoldTicketsModal } from "./SoldTicketsModal";

// Types
interface EventStats {
  ticketsSold: number;
  totalCapacity: number;
  revenue: number;
  checkIns: number;
  totalPasses: number;
  occupancyRate: number;
}

interface TicketType {
  id: number;
  name: string;
  price: number;
  sold: number;
  available: number;
}

interface Event {
  id: number;
  name: string;
  slug: string;
  description?: string;
  start_time: string;
  end_time: string;
  max_capacity?: number;
  status: string;
  venue?: { id: number; name: string; address?: string };
  stats: EventStats;
  ticketTypes: TicketType[];
  eventStatus: "live" | "upcoming" | "past";
}

interface Summary {
  totalEvents: number;
  totalRevenue: number;
  totalTicketsSold: number;
  totalCheckIns: number;
  upcomingEvents: number;
  pastEvents: number;
  liveEvents?: number;
}

interface OrganizerDashboardProps {
  user: { id: string; email?: string };
  profile: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string;
  } | null;
}

// Executive Metric Card
function ExecutiveInsightCard({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  color,
  prefix = "",
  delay = 0,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  badgeText?: string;
  color: "primary" | "blue" | "green" | "amber" | "purple";
  prefix?: string;
  delay?: number;
}) {
  const colorStyles = {
    primary: {
      border: "hover:border-primary/50",
      iconBg: "bg-primary/10 text-primary",
      gradient: "from-primary/10 via-background to-background",
      badge: "bg-primary/10 text-primary border-primary/20",
    },
    blue: {
      border: "hover:border-blue-500/50",
      iconBg: "bg-blue-500/10 text-blue-500",
      gradient: "from-blue-500/10 via-background to-background",
      badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
    green: {
      border: "hover:border-emerald-500/50",
      iconBg: "bg-emerald-500/10 text-emerald-500",
      gradient: "from-emerald-500/10 via-background to-background",
      badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    amber: {
      border: "hover:border-amber-500/50",
      iconBg: "bg-amber-500/10 text-amber-500",
      gradient: "from-amber-500/10 via-background to-background",
      badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    purple: {
      border: "hover:border-purple-500/50",
      iconBg: "bg-purple-500/10 text-purple-500",
      gradient: "from-purple-500/10 via-background to-background",
      badge: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    },
  };

  const style = colorStyles[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.3 }}
      className={cn(
        "relative rounded-2xl border bg-card/70 backdrop-blur-md p-5 sm:p-6 shadow-sm transition-all duration-300",
        "bg-gradient-to-br",
        style.gradient,
        style.border
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("rounded-xl p-2.5 sm:p-3", style.iconBg)}>
          {icon}
        </div>
        {badgeText && (
          <Badge
            variant="outline"
            className={cn("text-[11px] font-semibold px-2 py-0.5", style.badge)}
          >
            {badgeText}
          </Badge>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {prefix}
          <AnimatedCounter value={value} />
        </div>
        <p className="text-sm font-semibold text-foreground/90 mt-1">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </motion.div>
  );
}

// Upgraded Event Card Component with Direct Passes Action
function EventCard({
  event,
  index,
  onExport,
  onViewQuickModal,
}: {
  event: Event;
  index: number;
  onExport: () => void;
  onViewQuickModal: () => void;
}) {
  const statusColors = {
    live: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
    upcoming:
      "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40",
    past: "bg-muted text-muted-foreground border-border",
  };

  const statusLabels = {
    live: "Live Now",
    upcoming: "Upcoming",
    past: "Completed",
  };

  const checkInPct =
    event.stats.ticketsSold > 0
      ? Math.round((event.stats.checkIns / event.stats.ticketsSold) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border bg-card/60 backdrop-blur-md overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
    >
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Status & Timing */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span
              className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5",
                statusColors[event.eventStatus]
              )}
            >
              {event.eventStatus === "live" && (
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              )}
              {statusLabels[event.eventStatus]}
            </span>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {format(new Date(event.start_time), "MMM d, h:mm a")}
            </div>
          </div>

          <h3 className="font-bold text-lg text-foreground line-clamp-1">
            {event.name}
          </h3>

          {event.venue && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{event.venue.name}</span>
            </p>
          )}

          {/* Core Analytics Grid */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/40 bg-muted/20 p-3 rounded-xl">
            <div>
              <p className="text-base font-extrabold text-foreground">
                {event.stats.ticketsSold}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                Tickets Sold
              </p>
            </div>
            <div>
              <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {event.stats.checkIns}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({checkInPct}%)
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                Admitted
              </p>
            </div>
            <div>
              <p className="text-base font-extrabold text-foreground">
                {event.stats.revenue > 0
                  ? `PKR ${(event.stats.revenue / 1000).toFixed(0)}k`
                  : "PKR 0"}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                Revenue
              </p>
            </div>
          </div>

          {/* Occupancy Progress */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Capacity Occupancy</span>
              <span className="font-semibold text-foreground">
                {event.stats.occupancyRate}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  event.stats.occupancyRate >= 90
                    ? "bg-emerald-500"
                    : event.stats.occupancyRate >= 50
                    ? "bg-primary"
                    : "bg-blue-500"
                )}
                style={{
                  width: `${Math.min(100, event.stats.occupancyRate)}%`,
                }}
              />
            </div>
          </div>

          {/* Tier breakdown preview */}
          {event.ticketTypes?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/30 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Tier Allocation
              </p>
              <div className="space-y-1">
                {event.ticketTypes.slice(0, 3).map((tier) => {
                  const capacity =
                    tier.available != null ? tier.sold + tier.available : null;
                  const pct = capacity
                    ? Math.round((tier.sold / capacity) * 100)
                    : 0;
                  return (
                    <div
                      key={tier.id}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <span className="text-muted-foreground truncate max-w-[140px]">
                        {tier.name}
                      </span>
                      <span className="font-medium text-foreground">
                        {tier.sold} / {capacity ?? "∞"}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-5 pt-4 border-t border-border/40 space-y-2">
          {/* Primary Dedicated Full Page Button */}
          <Link
            href={`/dashboard/events/${event.id}/tickets`}
            className="block w-full"
          >
            <Button
              size="sm"
              className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            >
              <Ticket className="w-4 h-4 mr-2" />
              Manage Passes & Manifest
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <Link href={`/events/${event.slug}`} className="flex-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 bg-background/60"
              >
                <Eye className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                Live Page
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="text-xs h-8 px-3 bg-background/60"
              title="Export CSV Manifest"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Main Organizer Dashboard Component
export function OrganizerDashboard({
  user: _user,
  profile,
}: OrganizerDashboardProps) {
  const { toast } = useToast();
  const [events, setEvents] = React.useState<Event[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedEventForTickets, setSelectedEventForTickets] =
    React.useState<Event | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const response = await fetch("/api/organizer/events");
      const data = await response.json();

      if (response.ok) {
        setEvents(data.events || []);
        setSummary(data.summary || null);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load events",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds for live events
  React.useEffect(() => {
    const hasLiveEvent = events.some((e) => e.eventStatus === "live");
    if (!hasLiveEvent) return;

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [events, fetchData]);

  const exportAttendees = async (eventId: number) => {
    try {
      const response = await fetch(
        `/api/organizer/attendees?eventId=${eventId}`
      );
      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Failed to fetch attendees");

      if (!data.attendees || data.attendees.length === 0) {
        toast({
          title: "No Attendees",
          description: "No tickets have been sold for this event yet",
        });
        return;
      }

      const headers = [
        "Name",
        "Ticket Type",
        "Code",
        "Status",
        "Checked In At",
        "Email",
        "Phone",
      ];
      const rows = data.attendees.map((a: Record<string, unknown>) => [
        `"${a.guestName || ""}"`,
        `"${a.ticketType || ""}"`,
        `"${a.code || ""}"`,
        `"${a.status || ""}"`,
        `"${a.checkedInAt ? format(new Date(a.checkedInAt as string), "PPpp") : ""}"`,
        `"${a.buyerEmail || ""}"`,
        `"${a.buyerPhone || ""}"`,
      ]);

      const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join(
        "\n"
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const eventName = data.event?.name || `event-${eventId}`;
      a.download = `attendees-${eventName.replace(/[^a-zA-Z0-9]/g, "_")}-${format(
        new Date(),
        "yyyyMMdd_HHmm"
      )}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Exported",
        description: `${data.attendees.length} attendees exported successfully`,
      });
    } catch (_error) {
      toast({
        title: "Export Failed",
        description: "Could not export attendees",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground font-medium">
            Loading organizer command center...
          </p>
        </div>
      </div>
    );
  }

  const overallCheckInRate =
    summary && summary.totalTicketsSold > 0
      ? Math.round((summary.totalCheckIns / summary.totalTicketsSold) * 100)
      : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Executive Command Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/80 to-background p-6 md:p-8 shadow-sm backdrop-blur-md"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold px-2.5 py-0.5 rounded-full"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Organizer Command Hub
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d, yyyy")}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                {profile?.full_name?.split(" ")[0] || "Partner"}
              </span>
            </h1>

            <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Track live ticket sales velocity, gate attendance radar, attendee
              manifests, and settlement payouts in real time.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="h-10 px-4 gap-2 bg-background/60 hover:bg-background/90 border-border/70"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>

            <Link href="/dashboard/events">
              <Button
                size="sm"
                className="h-10 px-5 gap-2 bg-primary hover:bg-primary/90 shadow-md font-semibold"
              >
                <Plus className="w-4 h-4" />
                Create Event
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Live Event In Progress Alert */}
      {events.some((e) => e.eventStatus === "live") && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="w-5 h-5 text-emerald-500" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            </div>
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm sm:text-base">
                Live Event in Progress
              </p>
              <p className="text-xs text-emerald-600/90 dark:text-emerald-400/90">
                Ticket sales and check-in metrics are refreshing automatically every 30 seconds.
              </p>
            </div>
          </div>
          <Link href="/dashboard/events">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
            >
              View Active Event
            </Button>
          </Link>
        </motion.div>
      )}

      {/* High-Impact Executive Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Gross Revenue */}
          <ExecutiveInsightCard
            icon={<DollarSign className="w-5 h-5" />}
            title="Gross Ticket Revenue"
            value={summary.totalRevenue}
            subtitle="Gross sales across all events"
            prefix="PKR "
            badgeText="Financial Volume"
            color="primary"
            delay={0}
          />

          {/* Tickets Sold */}
          <ExecutiveInsightCard
            icon={<Ticket className="w-5 h-5" />}
            title="Total Tickets Sold"
            value={summary.totalTicketsSold}
            subtitle={`${summary.upcomingEvents} upcoming event${summary.upcomingEvents === 1 ? "" : "s"}`}
            badgeText="Sales Volume"
            color="blue"
            delay={1}
          />

          {/* Gate Check-Ins */}
          <ExecutiveInsightCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            title="Verified Gate Check-Ins"
            value={summary.totalCheckIns}
            subtitle={`${overallCheckInRate}% total check-in rate`}
            badgeText="Gate Operations"
            color="green"
            delay={2}
          />

          {/* Total Managed Events */}
          <ExecutiveInsightCard
            icon={<Calendar className="w-5 h-5" />}
            title="Active Events Portfolio"
            value={summary.totalEvents}
            subtitle={`${summary.pastEvents} past completed`}
            badgeText="Portfolio"
            color="purple"
            delay={3}
          />
        </div>
      )}

      {/* Quick Action Navigation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Link href="/dashboard/events" className="group">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              Event Management
            </h3>
            <p className="text-xs text-muted-foreground">Create & edit event listings</p>
          </div>
        </Link>

        <Link href="/dashboard/notifications" className="group">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              Sales & Activity Feed
            </h3>
            <p className="text-xs text-muted-foreground">Real-time alerts & updates</p>
          </div>
        </Link>

        <Link href="/dashboard/profile" className="group">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              Organizer Profile
            </h3>
            <p className="text-xs text-muted-foreground">Company details & settings</p>
          </div>
        </Link>
      </div>

      {/* Events Command Grid */}
      {events.length === 0 ? (
        <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur-sm p-12 text-center space-y-4">
          <Calendar className="w-12 h-12 text-muted-foreground/60 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-foreground">No Events Created Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Ready to launch your first event? Create your event listing to start selling tickets and admitting attendees.
            </p>
          </div>
          <Link href="/dashboard/events">
            <Button className="mt-2 bg-primary hover:bg-primary/90 font-semibold">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Event
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Your Events & Ticket Operations
              </h2>
              <p className="text-xs text-muted-foreground">
                Click &apos;Manage Passes &amp; Manifest&apos; for complete full-screen attendee analytics
              </p>
            </div>
            <Link href="/dashboard/events">
              <Button variant="ghost" size="sm" className="text-xs font-semibold text-primary">
                View All in Table <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {events.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={index}
                onExport={() => exportAttendees(event.id)}
                onViewQuickModal={() => setSelectedEventForTickets(event)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick Modal Preview Fallback */}
      <SoldTicketsModal
        eventId={selectedEventForTickets?.id || null}
        eventName={selectedEventForTickets?.name}
        isOpen={!!selectedEventForTickets}
        onClose={() => setSelectedEventForTickets(null)}
      />
    </div>
  );
}
