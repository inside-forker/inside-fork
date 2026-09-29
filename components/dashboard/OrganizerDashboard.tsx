"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
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

// Stat card
function PremiumStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
  prefix = "",
  delay = 0,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: "primary" | "blue" | "green" | "amber" | "purple";
  prefix?: string;
  delay?: number;
}) {
  const colorStyles = {
    primary: {
      border: "hover:border-primary/50",
      iconBg: "bg-primary/10 text-primary",
      gradient: "from-primary/5 via-transparent to-transparent",
    },
    blue: {
      border: "hover:border-blue-500/50",
      iconBg: "bg-blue-500/10 text-blue-500",
      gradient: "from-blue-500/5 via-transparent to-transparent",
    },
    green: {
      border: "hover:border-emerald-500/50",
      iconBg: "bg-emerald-500/10 text-emerald-500",
      gradient: "from-emerald-500/5 via-transparent to-transparent",
    },
    amber: {
      border: "hover:border-amber-500/50",
      iconBg: "bg-amber-500/10 text-amber-500",
      gradient: "from-amber-500/5 via-transparent to-transparent",
    },
    purple: {
      border: "hover:border-purple-500/50",
      iconBg: "bg-purple-500/10 text-purple-500",
      gradient: "from-purple-500/5 via-transparent to-transparent",
    },
  };

  const style = colorStyles[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
      className={cn(
        "relative rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300",
        "bg-gradient-to-br",
        style.gradient,
        style.border,
      )}
    >
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={cn("rounded-xl p-3", style.iconBg)}>{icon}</div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                trend.isPositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="text-2xl font-bold">
            {prefix}
            <AnimatedCounter value={value} />
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Event Card Component
function EventCard({
  event,
  index,
  onExport,
  onViewTickets,
}: {
  event: Event;
  index: number;
  onExport: () => void;
  onViewTickets: () => void;
}) {
  const statusColors = {
    live: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    upcoming:
      "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
    past: "bg-muted text-muted-foreground border-border",
  };

  const statusLabels = {
    live: "Live Now",
    upcoming: "Upcoming",
    past: "Completed",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden hover:border-primary/30 transition-colors flex flex-col justify-between"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full border",
                  statusColors[event.eventStatus],
                )}
              >
                {event.eventStatus === "live" && (
                  <span className="inline-block w-1.5 h-1.5 bg-current rounded-full mr-1 animate-pulse" />
                )}
                {statusLabels[event.eventStatus]}
              </span>
            </div>
            <h3 className="font-semibold text-lg truncate">{event.name}</h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {format(new Date(event.start_time), "MMM d, h:mm a")}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{event.venue.name}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t">
          <div>
            <p className="text-lg font-bold">{event.stats.ticketsSold}</p>
            <p className="text-xs text-muted-foreground">Sold</p>
          </div>
          <div>
            <p className="text-lg font-bold">{event.stats.checkIns}</p>
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </div>
          <div>
            <p className="text-lg font-bold">{event.stats.occupancyRate}%</p>
            <p className="text-xs text-muted-foreground">Capacity</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {event.stats.revenue > 0
                ? `${(event.stats.revenue / 1000).toFixed(0)}k`
                : "0"}
            </p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${event.stats.occupancyRate}%` }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className={cn(
                "h-full rounded-full",
                event.stats.occupancyRate >= 90
                  ? "bg-emerald-500"
                  : event.stats.occupancyRate >= 50
                    ? "bg-primary"
                    : "bg-amber-500",
              )}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 pt-0 space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onViewTickets}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Ticket className="w-4 h-4 mr-1.5" />
            Sold Tickets & PDFs
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex-1 border-primary/20 hover:bg-primary/5"
          >
            <Link href={`/admin/accounts?event_id=${event.id}`}>
              <SlidersHorizontal className="w-4 h-4 mr-1.5 text-primary" />
              Gate Console
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
          <Link href={`/dashboard/events`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Edit2 className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
          </Link>
          <Link href={`/events/${event.slug}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="w-4 h-4 mr-1.5" />
              View Page
            </Button>
          </Link>
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
  const [selectedEventForTickets, setSelectedEventForTickets] = React.useState<Event | null>(null);

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
        `/api/organizer/attendees?eventId=${eventId}`,
      );
      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Failed to fetch attendees");

      // Check if there are any attendees to export
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
      ];
      const rows = data.attendees.map((a: Record<string, unknown>) => [
        a.guestName || "",
        a.ticketType || "",
        a.code || "",
        a.status || "",
        a.checkedInAt ? format(new Date(a.checkedInAt as string), "PPpp") : "",
        a.buyerEmail || "",
      ]);

      const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const eventName = data.event?.name || `event-${eventId}`;
      a.download = `attendees-${eventName.replace(/\s+/g, "-")}-${format(
        new Date(),
        "yyyy-MM-dd",
      )}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Exported",
        description: `${data.attendees.length} attendees exported`,
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading organizer dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-background p-6 md:p-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Ticket className="w-5 h-5" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                Organizer Portal
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Welcome back,{" "}
              <span className="gradient-text-primary">
                {profile?.full_name?.split(" ")[0] || "Organizer"}
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your events, sold ticket passes, gate allocations, and verify attendees
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Link href="/dashboard/scan">
              <Button size="sm" className="gap-2 shadow-premium">
                <ScanLine className="w-4 h-4" />
                Verify Tickets
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Live Events Banner */}
      {events.some((e) => e.eventStatus === "live") && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3"
        >
          <div className="relative">
            <Radio className="w-5 h-5 text-emerald-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Live Event in Progress
            </p>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
              Stats refresh automatically every 30 seconds
            </p>
          </div>
        </motion.div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <PremiumStatCard
            icon={<Calendar className="w-5 h-5" />}
            title="Total Events"
            value={summary.totalEvents}
            subtitle={`${summary.upcomingEvents} upcoming, ${summary.pastEvents} completed`}
            color="primary"
            delay={0}
          />
          <PremiumStatCard
            icon={<Ticket className="w-5 h-5" />}
            title="Tickets Sold"
            value={summary.totalTicketsSold}
            subtitle="Across all events"
            color="blue"
            delay={1}
          />
          <PremiumStatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            title="Check-ins"
            value={summary.totalCheckIns}
            subtitle="Verified attendees"
            color="green"
            delay={2}
          />
          <PremiumStatCard
            icon={<DollarSign className="w-5 h-5" />}
            title="Total Revenue"
            value={summary.totalRevenue}
            subtitle="PKR earned"
            prefix="PKR "
            color="amber"
            delay={3}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Link href="/dashboard/events">
            <div className="rounded-xl border bg-card/50 p-4 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group">
              <Plus className="w-8 h-8 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold">Manage Events</h3>
              <p className="text-sm text-muted-foreground">Create & edit</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link href="/admin/accounts">
            <div className="rounded-xl border bg-card/50 p-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
              <SlidersHorizontal className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold">Gate & Device Hub</h3>
              <p className="text-sm text-muted-foreground">Lanes & staff control</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Link href="/dashboard/scan">
            <div className="rounded-xl border bg-card/50 p-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group">
              <ScanLine className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold">Scan Tickets</h3>
              <p className="text-sm text-muted-foreground">Verify & check-in</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link href="/dashboard/notifications">
            <div className="rounded-xl border bg-card/50 p-4 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer group">
              <Activity className="w-8 h-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted-foreground">Sales & updates</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Link href="/dashboard/profile">
            <div className="rounded-xl border bg-card/50 p-4 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all cursor-pointer group">
              <Users className="w-8 h-8 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold">Profile</h3>
              <p className="text-sm text-muted-foreground">Organizer profile</p>
            </div>
          </Link>
        </motion.div>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="rounded-2xl border bg-card/50 p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
          <p className="text-muted-foreground mb-4">
            You haven&apos;t been assigned any events. Contact admin to get
            started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Events</h2>
            <p className="text-sm text-muted-foreground">
              {events.length} total
            </p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {events.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={index}
                onExport={() => exportAttendees(event.id)}
                onViewTickets={() => setSelectedEventForTickets(event)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sold Tickets & PDF Viewer Dialog */}
      <SoldTicketsModal
        eventId={selectedEventForTickets?.id || null}
        eventName={selectedEventForTickets?.name}
        isOpen={!!selectedEventForTickets}
        onClose={() => setSelectedEventForTickets(null)}
      />
    </div>
  );
}
