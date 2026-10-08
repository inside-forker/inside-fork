"use client";

import { Download } from "lucide-react";
import type { PublicPdfTicket } from "@/types/ticketing.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  tickets: PublicPdfTicket[];
  variant?: "default" | "dashboard";
}

export function BookingPdfTicketList({
  tickets,
  variant = "default",
}: Props) {
  if (tickets.length === 0) return null;

  return (
    <ul className="space-y-3">
      {tickets.map((ticket, index) => (
        <li
          key={ticket.id}
          className={cn(
            "rounded-2xl border overflow-hidden",
            variant === "dashboard"
              ? "border-border bg-card"
              : "border-neutral-700/40 bg-neutral-800/90",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between px-4 py-3 border-b",
              variant === "dashboard"
                ? "bg-muted border-border"
                : "bg-neutral-700/50 border-neutral-600/40",
            )}
          >
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-[0.2em]",
                variant === "dashboard" ? "text-primary" : "text-white/80",
              )}
            >
              Ticket #{index + 1}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              PDF ready
            </span>
          </div>
          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {ticket.ticket_type_name || "Event ticket"}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Ticket ID: {ticket.external_ticket_id}
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href={ticket.download_path} download>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download PDF
              </a>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
