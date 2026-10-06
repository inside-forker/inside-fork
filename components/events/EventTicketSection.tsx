"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ticket, Plus, Minus, Clock, Users, CreditCard } from "lucide-react";
import { EventTicketSectionProps, TicketType } from "@/types/events.types";
import { PremiumHeading } from "@/components/brand/Typography";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/context/cartStore";
import { computeParchiDiscount, PARCHI_BLUE } from "@/lib/parchi/discount";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";
import {
  sectionVariants,
  cardGridVariants,
  cardVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

export function EventTicketSection({
  event,
  ticketTypes,
  parchiOffer,
}: EventTicketSectionProps) {
  const router = useRouter();
  // Visitors from the Parchi app see the student price up front. It's a
  // preview: the discount is applied at checkout once they approve in Parchi.
  const arrivedFromParchi = useArrivedFromParchi();
  const showParchiPrice = !!parchiOffer && arrivedFromParchi;
  // Rounded for display, like the rest of the site's prices; the exact
  // amount is charged at checkout.
  const parchiPrice = (amount: number) =>
    parchiOffer
      ? Math.round(amount - computeParchiDiscount(parchiOffer, amount))
      : amount;
  const { addItem, clearCart } = useCartStore();
  const [selectedTickets, setSelectedTickets] = useState<
    Record<number, number>
  >({});

  const updateTicketQuantity = (ticketId: number, quantity: number) => {
    setSelectedTickets((prev) => ({
      ...prev,
      [ticketId]: Math.max(0, quantity),
    }));
  };

  const FALLBACK_TICKET_DESCRIPTION =
    "Premium event ticket with full access to all activities and amenities.";

  const getTotalPrice = () => {
    return Object.entries(selectedTickets).reduce((total, [id, quantity]) => {
      const ticket = ticketTypes.find((t) => t.id === parseInt(id));
      return total + (ticket?.price || 0) * quantity;
    }, 0);
  };

  const getTotalTickets = () => {
    return Object.values(selectedTickets).reduce(
      (total, quantity) => total + quantity,
      0
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const isTicketAvailable = (ticket: TicketType) => {
    const now = new Date();
    if (new Date(ticket.sale_starts_at) > now) return false;
    if (new Date(ticket.sale_ends_at) < now) return false;
    return ticket.quantity_available === null || ticket.quantity_available > 0;
  };

  const getTicketStatus = (ticket: TicketType) => {
    const now = new Date();
    if (new Date(ticket.sale_starts_at) > now) {
      return { text: "Coming Soon", variant: "secondary" as const };
    }
    if (new Date(ticket.sale_ends_at) < now) {
      return { text: "Sale Ended", variant: "secondary" as const };
    }
    if (ticket.quantity_available === 0) {
      return { text: "Sold Out", variant: "destructive" as const };
    }
    if (ticket.quantity_available !== null && ticket.quantity_available <= 10) {
      return {
        text: `${ticket.quantity_available} left`,
        variant: "destructive" as const,
      };
    }
    return { text: "Available", variant: "default" as const };
  };

  const handleProceedToCheckout = () => {
    clearCart();
    Object.entries(selectedTickets).forEach(([id, quantity]) => {
      if (quantity > 0) {
        const ticket = ticketTypes.find((t) => t.id === parseInt(id));
        if (ticket) {
          addItem({
            ticketTypeId: ticket.id,
            eventId: event.id,
            eventName: event.name,
            ticketName: ticket.name,
            price: ticket.price,
            quantity: quantity,
            maxQuantity: ticket.quantity_available || undefined,
          });
        }
      }
    });
    router.push("/checkout");
  };

  return (
    <motion.div
      id="tickets"
      className="space-y-8 scroll-mt-24"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      <div className="flex items-center space-x-3">
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
          <Ticket className="w-5 h-5 text-primary" />
        </div>
        <PremiumHeading level={2} dense className="text-foreground">
          Select <span className="text-primary">Tickets</span>
        </PremiumHeading>
      </div>

      <motion.div className="grid gap-6" variants={cardGridVariants}>
        {ticketTypes.map((ticket) => {
          const status = getTicketStatus(ticket);
          const isAvailable = isTicketAvailable(ticket);
          const selectedQuantity = selectedTickets[ticket.id] || 0;
          const perPersonLimit = ticket.max_per_person ?? 10;
          const stockLimit =
            ticket.quantity_available === null
              ? Number.MAX_SAFE_INTEGER
              : ticket.quantity_available;
          const maxQuantity = Math.min(perPersonLimit, stockLimit);

          return (
            <motion.div key={ticket.id} variants={cardVariants}>
              <Card className="group relative overflow-hidden bg-card border rounded-2xl p-4 md:p-6 lg:p-8 hover:border-primary/40 transition-all duration-300">
                {/* Mobile: Stack vertically, Desktop: Side by side */}
                <div className="flex flex-col gap-4 lg:gap-6">
                  {/* Top row: Ticket info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold mb-1">
                          {ticket.name}
                        </h3>
                        <p className="text-muted-foreground text-xs sm:text-sm line-clamp-2">
                          {ticket.description?.trim()
                            ? ticket.description
                            : FALLBACK_TICKET_DESCRIPTION}
                        </p>
                      </div>
                      {/* Price - Always visible on the right */}
                      <div className="text-right flex-shrink-0">
                        <Badge variant={status.variant} className="mb-1">
                          {status.text}
                        </Badge>
                        {showParchiPrice && ticket.price > 0 ? (
                          <>
                            <div className="text-sm text-muted-foreground line-through whitespace-nowrap">
                              {formatPrice(ticket.price)}
                            </div>
                            <div
                              className="text-xl sm:text-2xl md:text-3xl font-bold whitespace-nowrap"
                              style={{ color: PARCHI_BLUE }}
                            >
                              {formatPrice(parchiPrice(ticket.price))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Parchi student price
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xl sm:text-2xl md:text-3xl font-bold whitespace-nowrap">
                              {formatPrice(ticket.price)}
                            </div>
                            {ticket.price > 0 && (
                              <div className="text-xs text-muted-foreground">
                                per ticket
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>
                            {ticket.quantity_available === null
                              ? "Unlimited"
                              : `${ticket.quantity_available} left`}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>
                            Ends{" "}
                            {new Date(ticket.sale_ends_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {isAvailable && (
                        <div className="flex items-center space-x-2 sm:space-x-3 bg-background rounded-full p-0.5 sm:p-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full"
                            aria-label={`Decrease quantity for ${ticket.name}`}
                            onClick={() =>
                              updateTicketQuantity(
                                ticket.id,
                                selectedQuantity - 1
                              )
                            }
                            disabled={selectedQuantity === 0}
                          >
                            <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>

                          <div className="w-8 sm:w-10 md:w-12 text-center font-semibold text-sm sm:text-base">
                            {selectedQuantity}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full"
                            aria-label={`Increase quantity for ${ticket.name}`}
                            onClick={() =>
                              updateTicketQuantity(
                                ticket.id,
                                selectedQuantity + 1
                              )
                            }
                            disabled={selectedQuantity >= maxQuantity}
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Removed duplicate bottom-row selector - moved inline in the info row */}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {getTotalTickets() > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4 z-10"
        >
          <Card className="p-6 bg-card border rounded-2xl hover:border-primary/40 transition-all duration-300">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h4 className="text-base sm:text-lg font-semibold mb-1">
                  {getTotalTickets()} ticket{getTotalTickets() !== 1 ? "s" : ""}{" "}
                  selected
                </h4>
                <p className="text-muted-foreground">
                  Total:{" "}
                  {showParchiPrice && getTotalPrice() > 0 ? (
                    <>
                      <span className="line-through mr-2">
                        {formatPrice(getTotalPrice())}
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: PARCHI_BLUE }}
                      >
                        {formatPrice(parchiPrice(getTotalPrice()))}
                      </span>{" "}
                      <span className="text-xs">with Parchi</span>
                    </>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {formatPrice(getTotalPrice())}
                    </span>
                  )}
                </p>
              </div>

              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-3 rounded-xl transition-all duration-300"
                onClick={handleProceedToCheckout}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Proceed to Checkout
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
