"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Minus, CreditCard } from "lucide-react";
import { EventTicketSectionProps, TicketType } from "@/types/events.types";
import { PremiumHeading } from "@/components/brand/Typography";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/context/cartStore";
import {
  computeParchiDiscount,
  describeParchiOffer,
  PARCHI_BLUE,
} from "@/lib/parchi/discount";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";
import { isPrismfestSlug } from "@/lib/events/prismfest";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
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
  const { user, isLoading: isUserLoading } = useSupabaseUser();
  // Parchi-app visitors: full prices + Parchi 2FA later. IK on Prismfest
  // (not from Parchi): show IK's own slash; logged-out must sign in to get it.
  const arrivedFromParchi = useArrivedFromParchi();
  const showIkStudentPrice =
    !!parchiOffer &&
    !arrivedFromParchi &&
    isPrismfestSlug(event.slug);
  const studentPrice = (amount: number) =>
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
      0,
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
    // On sale: no badge (stock counts aren't shown)
    return null;
  };

  const renderStepper = (
    ticket: TicketType,
    selectedQuantity: number,
    maxQuantity: number,
  ) => (
    <div className="flex items-center space-x-2 sm:space-x-3 bg-background rounded-full p-0.5 sm:p-1 shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full"
        aria-label={`Decrease quantity for ${ticket.name}`}
        onClick={() => updateTicketQuantity(ticket.id, selectedQuantity - 1)}
        disabled={selectedQuantity === 0}
      >
        <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>

      <div className="w-6 sm:w-10 md:w-12 text-center font-semibold text-sm sm:text-base">
        {selectedQuantity}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full"
        aria-label={`Increase quantity for ${ticket.name}`}
        onClick={() => updateTicketQuantity(ticket.id, selectedQuantity + 1)}
        disabled={selectedQuantity >= maxQuantity}
      >
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>
    </div>
  );

  const goToCheckout = () => {
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
      className="space-y-4 md:space-y-8 scroll-mt-24"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      <PremiumHeading level={2} dense className="text-foreground">
        Select <span className="text-primary">Tickets</span>
      </PremiumHeading>

      <motion.div className="grid gap-3 md:gap-6" variants={cardGridVariants}>
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
          const description = ticket.description?.trim()
            ? ticket.description
            : FALLBACK_TICKET_DESCRIPTION;

          return (
            <motion.div key={ticket.id} variants={cardVariants}>
              <Card className="group relative overflow-hidden bg-card border rounded-2xl p-4 md:p-6 lg:p-8 hover:border-primary/40 transition-all duration-300">
                {/* Phones: one compact row - name, line and price left; stepper right */}
                <div className="flex items-center gap-3 md:hidden">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold leading-snug">
                      {ticket.name}
                    </h3>
                    {/* Only the organiser's own short line - not the generic fallback */}
                    {ticket.description?.trim() && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {ticket.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                      {showIkStudentPrice && ticket.price > 0 ? (
                        <>
                          <span className="text-lg font-bold whitespace-nowrap text-primary">
                            {formatPrice(studentPrice(ticket.price))}
                          </span>
                          <span className="text-xs text-muted-foreground line-through whitespace-nowrap">
                            {formatPrice(ticket.price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold whitespace-nowrap">
                          {formatPrice(ticket.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isAvailable
                    ? renderStepper(ticket, selectedQuantity, maxQuantity)
                    : status && (
                        <Badge variant={status.variant} className="shrink-0">
                          {status.text}
                        </Badge>
                      )}
                </div>

                {/* Tablet & desktop */}
                <div className="hidden md:flex flex-col gap-3 lg:gap-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-xl lg:text-2xl font-semibold mb-1">
                        {ticket.name}
                      </h3>
                      <p className="text-muted-foreground text-sm line-clamp-2">
                        {description}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {status && (
                        <Badge variant={status.variant} className="mb-1">
                          {status.text}
                        </Badge>
                      )}
                      {showIkStudentPrice && ticket.price > 0 ? (
                        <>
                          <div className="text-sm text-muted-foreground line-through whitespace-nowrap">
                            {formatPrice(ticket.price)}
                          </div>
                          <div className="text-3xl font-bold whitespace-nowrap text-primary">
                            {formatPrice(studentPrice(ticket.price))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Inside Karachi price
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl font-bold whitespace-nowrap">
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

                  {isAvailable && (
                    <div className="flex justify-end">
                      {renderStepper(ticket, selectedQuantity, maxQuantity)}
                    </div>
                  )}
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
          className="sticky bottom-24 md:bottom-6 z-40"
        >
          <Card className="p-4 sm:p-6 bg-card/95 backdrop-blur-md border border-border shadow-2xl hover:border-primary/40 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h4 className="text-sm sm:text-base md:text-lg font-semibold mb-0.5">
                  {getTotalTickets()} ticket{getTotalTickets() !== 1 ? "s" : ""}{" "}
                  selected
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Total:{" "}
                  {showIkStudentPrice && getTotalPrice() > 0 ? (
                    <>
                      <span className="line-through mr-1.5 sm:mr-2">
                        {formatPrice(getTotalPrice())}
                      </span>
                      <span className="font-semibold text-primary">
                        {formatPrice(studentPrice(getTotalPrice()))}
                      </span>{" "}
                      <span className="text-xs">with Inside Karachi</span>
                    </>
                  ) : (
                    <span className="font-semibold text-foreground">
                      {formatPrice(getTotalPrice())}
                    </span>
                  )}
                  {arrivedFromParchi && (
                    <span className="block text-xs mt-0.5" style={{ color: PARCHI_BLUE }}>
                      Parchi discount applies after you verify at checkout
                    </span>
                  )}
                  {showIkStudentPrice && !user && !isUserLoading && (
                    <span className="block text-xs mt-0.5 text-primary">
                      Sign in at checkout to get this price
                    </span>
                  )}
                </p>
              </div>

              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl transition-all duration-300 w-full sm:w-auto shadow-lg shadow-primary/25 text-sm sm:text-base"
                onClick={goToCheckout}
              >
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Proceed to Checkout
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
