"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Minus, CreditCard, ExternalLink, ChevronDown } from "lucide-react";
import { EventTicketSectionProps, TicketType } from "@/types/events.types";
import { PremiumHeading } from "@/components/brand/Typography";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/context/cartStore";
import {
  computeParchiDiscount,
  PARCHI_BLUE,
  resolveStudentOffer,
} from "@/lib/parchi/discount";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";
import {
  isPrismfestSlug,
  getPrismfestOriginalPrice,
  getPrismfestDiscountedPrice,
} from "@/lib/events/prismfest";
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
  // Parchi-app visitors: full prices + Parchi 2FA later. Anyone else on
  // Prismfest: Inside Karachi slashed prices (coupon or 50% fallback).
  const arrivedFromParchi = useArrivedFromParchi();
  const isPrismfest = isPrismfestSlug(event.slug);
  const studentOffer =
    !arrivedFromParchi
      ? isPrismfest
        ? resolveStudentOffer(parchiOffer)
        : (parchiOffer ?? null)
      : null;
  const showIkStudentPrice = !!studentOffer;
  const studentPrice = (amount: number) =>
    studentOffer
      ? Math.round(amount - computeParchiDiscount(studentOffer, amount))
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

  const getTicketDiscountedPrice = (ticket: TicketType) => {
    if (isPrismfest) {
      const prismPrice = getPrismfestDiscountedPrice(ticket.name);
      if (prismPrice != null) return prismPrice;
    }
    return studentPrice(ticket.price);
  };

  const getTotalDiscountedPrice = () => {
    return Object.entries(selectedTickets).reduce((total, [id, quantity]) => {
      const ticket = ticketTypes.find((t) => t.id === parseInt(id));
      if (!ticket || quantity <= 0) return total;
      return total + getTicketDiscountedPrice(ticket) * quantity;
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

  interface TicketGroup {
    name: string | null;
    tickets: TicketType[];
  }

  const ticketGroups = useMemo(() => {
    const groupMap = new Map<string, TicketType[]>();
    const ungrouped: TicketType[] = [];

    ticketTypes.forEach((ticket) => {
      const gName = ticket.group_name?.trim();
      if (gName) {
        if (!groupMap.has(gName)) {
          groupMap.set(gName, []);
        }
        groupMap.get(gName)!.push(ticket);
      } else {
        ungrouped.push(ticket);
      }
    });

    const list: TicketGroup[] = [];
    groupMap.forEach((tickets, name) => {
      list.push({ name, tickets });
    });
    if (ungrouped.length > 0) {
      list.push({ name: null, tickets: ungrouped });
    }
    return list;
  }, [ticketTypes]);

  const hasGroups = useMemo(() => {
    return ticketTypes.some((t) => !!t.group_name?.trim());
  }, [ticketTypes]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const renderAccordionStepper = (
    ticket: TicketType,
    selectedQuantity: number,
    maxQuantity: number,
  ) => (
    <div className="flex items-center space-x-1 sm:space-x-2 bg-zinc-900 border border-zinc-800 rounded-full px-1.5 py-0.5 sm:px-2 sm:py-1 shrink-0">
      <button
        type="button"
        onClick={() => updateTicketQuantity(ticket.id, selectedQuantity - 1)}
        disabled={selectedQuantity === 0}
        className="h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-red-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        aria-label={`Decrease quantity for ${ticket.name}`}
      >
        <div className="w-5 h-5 rounded-full border border-red-500/60 flex items-center justify-center">
          <Minus className="w-3 h-3 text-red-400" />
        </div>
      </button>

      <span className="w-5 sm:w-7 text-center font-medium text-xs sm:text-sm text-foreground">
        {selectedQuantity}
      </span>

      <button
        type="button"
        onClick={() => updateTicketQuantity(ticket.id, selectedQuantity + 1)}
        disabled={selectedQuantity >= maxQuantity}
        className="h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        aria-label={`Increase quantity for ${ticket.name}`}
      >
        <div className="w-5 h-5 rounded-full border border-zinc-600 flex items-center justify-center">
          <Plus className="w-3 h-3 text-zinc-300" />
        </div>
      </button>
    </div>
  );

  const renderAccordionTicketRow = (ticket: TicketType) => {
    const status = getTicketStatus(ticket);
    const isAvailable = isTicketAvailable(ticket);
    const selectedQuantity = selectedTickets[ticket.id] || 0;
    const perPersonLimit = ticket.max_per_person ?? 10;
    const stockLimit =
      ticket.quantity_available === null
        ? Number.MAX_SAFE_INTEGER
        : ticket.quantity_available;
    const maxQuantity = Math.min(perPersonLimit, stockLimit);
    const originalPrice = isPrismfest
      ? getPrismfestOriginalPrice(ticket.name)
      : null;

    return (
      <div
        key={ticket.id}
        className="flex items-center justify-between gap-3 py-3 px-3 sm:px-5 hover:bg-white/[0.02] transition-colors"
      >
        {/* Left: Name & optional description/group badge */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm sm:text-base text-foreground leading-snug">
              {ticket.name}
            </span>
            {(ticket.people_per_ticket ?? 1) > 1 && (
              <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Group of {ticket.people_per_ticket}
              </span>
            )}
          </div>
          {ticket.description?.trim() && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {ticket.description}
            </p>
          )}
        </div>

        {/* Middle: Price */}
        <div className="text-right shrink-0 px-2 sm:px-4">
          {showIkStudentPrice && ticket.price > 0 ? (
            <div className="flex flex-col items-end">
              <span className="text-sm sm:text-base font-bold text-primary whitespace-nowrap">
                {formatPrice(getTicketDiscountedPrice(ticket))}
              </span>
              <span className="text-[11px] text-muted-foreground line-through whitespace-nowrap">
                {formatPrice(
                  originalPrice && originalPrice > ticket.price
                    ? originalPrice
                    : ticket.price,
                )}
              </span>
            </div>
          ) : (
            <span className="text-sm sm:text-base font-semibold text-foreground whitespace-nowrap">
              {formatPrice(ticket.price)}
            </span>
          )}
        </div>

        {/* Right: Stepper or External URL or Sold out badge */}
        <div className="shrink-0">
          {ticket.ticket_url ? (
            <Button
              size="sm"
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 py-1.5 text-xs inline-flex items-center gap-1 shadow-sm"
              asChild
            >
              <a
                href={ticket.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy Pass
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </Button>
          ) : isAvailable ? (
            renderAccordionStepper(ticket, selectedQuantity, maxQuantity)
          ) : (
            status && (
              <Badge variant={status.variant} className="shrink-0 text-xs">
                {status.text}
              </Badge>
            )
          )}
        </div>
      </div>
    );
  };

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

      {hasGroups ? (
        <div className="space-y-4">
          {ticketGroups.map((group, groupIdx) => {
            const groupKey = group.name || `ungrouped-${groupIdx}`;
            const isCollapsed = group.name ? !!collapsedGroups[group.name] : false;

            return (
              <Card
                key={groupKey}
                className="overflow-hidden border border-zinc-800/80 bg-zinc-950/70 rounded-2xl shadow-lg"
              >
                {group.name ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name!)}
                    className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 rounded-xl my-2 mx-auto max-w-[calc(100%-1rem)] transition-all cursor-pointer select-none"
                  >
                    <span className="w-5 sm:w-6" />
                    <span className="text-emerald-400 font-bold text-sm sm:text-base tracking-wide text-center">
                      {group.name}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-emerald-400 transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      }`}
                    />
                  </button>
                ) : (
                  <div className="px-4 sm:px-6 py-3 border-b border-zinc-800/80">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      General Passes
                    </h4>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key={`group-body-${groupKey}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-zinc-800/60 pb-1">
                        {group.tickets.map((ticket) =>
                          renderAccordionTicketRow(ticket),
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      ) : (
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
          const originalPrice = isPrismfest
            ? getPrismfestOriginalPrice(ticket.name)
            : null;

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
                            {formatPrice(getTicketDiscountedPrice(ticket))}
                          </span>
                          <span className="text-xs text-muted-foreground line-through whitespace-nowrap">
                            {formatPrice(
                              originalPrice && originalPrice > ticket.price
                                ? originalPrice
                                : ticket.original_price && ticket.original_price > ticket.price
                                ? ticket.original_price
                                : ticket.price,
                            )}
                          </span>
                        </>
                      ) : ticket.original_price && ticket.original_price > ticket.price ? (
                        <>
                          <span className="text-lg font-bold whitespace-nowrap text-emerald-400">
                            {formatPrice(ticket.price)}
                          </span>
                          <span className="text-xs text-muted-foreground line-through whitespace-nowrap">
                            {formatPrice(ticket.original_price)}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            {Math.round(((ticket.original_price - ticket.price) / ticket.original_price) * 100)}% OFF
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold whitespace-nowrap">
                          {formatPrice(ticket.price)}
                        </span>
                      )}
                    </div>
                  </div>

                  {ticket.ticket_url ? (
                    <Button
                      size="sm"
                      className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 py-1.5 text-xs shrink-0 inline-flex items-center gap-1 shadow-sm"
                      asChild
                    >
                      <a
                        href={ticket.ticket_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buy Pass
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </Button>
                  ) : isAvailable ? (
                    renderStepper(ticket, selectedQuantity, maxQuantity)
                  ) : (
                    status && (
                      <Badge variant={status.variant} className="shrink-0">
                        {status.text}
                      </Badge>
                    )
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
                            {formatPrice(
                              originalPrice && originalPrice > ticket.price
                                ? originalPrice
                                : ticket.original_price && ticket.original_price > ticket.price
                                ? ticket.original_price
                                : ticket.price,
                            )}
                          </div>
                          <div className="text-3xl font-bold whitespace-nowrap text-primary">
                            {formatPrice(getTicketDiscountedPrice(ticket))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Inside Karachi price
                          </div>
                        </>
                      ) : ticket.original_price && ticket.original_price > ticket.price ? (
                        <>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm text-muted-foreground line-through whitespace-nowrap">
                              {formatPrice(ticket.original_price)}
                            </span>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              {Math.round(((ticket.original_price - ticket.price) / ticket.original_price) * 100)}% OFF
                            </span>
                          </div>
                          <div className="text-3xl font-bold whitespace-nowrap text-emerald-400">
                            {formatPrice(ticket.price)}
                          </div>
                          {ticket.price > 0 && (
                            <div className="text-xs text-muted-foreground">
                              per ticket
                            </div>
                          )}
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

                  {ticket.ticket_url ? (
                    <div className="flex justify-end">
                      <Button
                        size="default"
                        className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-2 inline-flex items-center gap-2 shadow-md shadow-primary/20"
                        asChild
                      >
                        <a
                          href={ticket.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Buy Pass
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      </Button>
                    </div>
                  ) : isAvailable ? (
                    <div className="flex justify-end">
                      {renderStepper(ticket, selectedQuantity, maxQuantity)}
                    </div>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
      )}

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
                        {formatPrice(getTotalDiscountedPrice())}
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
