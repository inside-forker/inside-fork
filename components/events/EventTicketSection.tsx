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
import { PARCHI_BLUE, tierStudentPrice } from "@/lib/parchi/discount";
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
  // Parchi toggle on (the offer is only set then): Parchi-app visitors see
  // the Parchi rate (unlocked by Parchi 2FA at checkout); everyone else sees
  // the same price as Inside Karachi's own discount.
  const arrivedFromParchi = useArrivedFromParchi();
  const parchiEnabled = !!parchiOffer;
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

  function getTicketPricing(ticket: TicketType) {
    // Student prices are a Parchi-app thing: Inside visitors see list prices.
    const studentPrice =
      parchiEnabled && arrivedFromParchi ? tierStudentPrice(ticket) : null;
    const hasParchiPrice = studentPrice != null;

    if (studentPrice != null) {
      const salePrice = studentPrice;
      const comparePrice =
        ticket.parchi_original_price && ticket.parchi_original_price > salePrice
          ? ticket.parchi_original_price
          : ticket.price;
      return {
        mode: "parchi" as const,
        salePrice,
        comparePrice,
        hasParchiPrice,
      };
    }

    const salePrice = ticket.price;
    const comparePrice =
      ticket.original_price && ticket.original_price > salePrice
        ? ticket.original_price
        : null;
    return {
      mode: "native" as const,
      salePrice,
      comparePrice,
      hasParchiPrice,
    };
  }

  const renderTicketCard = (ticket: TicketType) => {
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
              {ticket.description?.trim() && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {ticket.description}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                {(() => {
                  const pricing = getTicketPricing(ticket);
                  if (pricing.mode === "parchi") {
                    return (
                      <>
                        <span className="text-lg font-bold whitespace-nowrap text-[#0069DB]">
                          {formatPrice(pricing.salePrice)}
                        </span>
                        {pricing.comparePrice && (
                          <span className="text-xs text-muted-foreground line-through whitespace-nowrap">
                            {formatPrice(pricing.comparePrice)}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#0069DB] bg-[#0069DB]/10 border border-[#0069DB]/20 px-1.5 py-0.5 rounded">
                          PARCHI RATE
                        </span>
                      </>
                    );
                  }
                  if (pricing.comparePrice) {
                    return (
                      <>
                        <span className="text-lg font-bold whitespace-nowrap text-emerald-400">
                          {formatPrice(pricing.salePrice)}
                        </span>
                        <span className="text-xs text-muted-foreground line-through whitespace-nowrap">
                          {formatPrice(pricing.comparePrice)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          {Math.round(((pricing.comparePrice - pricing.salePrice) / pricing.comparePrice) * 100)}% OFF
                        </span>
                      </>
                    );
                  }
                  return (
                    <>
                      <span className="text-lg font-bold whitespace-nowrap">
                        {formatPrice(pricing.salePrice)}
                      </span>
                      {pricing.hasParchiPrice && (
                        <span className="text-[10px] font-bold text-[#0069DB] bg-[#0069DB]/10 border border-[#0069DB]/20 px-1.5 py-0.5 rounded">
                          Students: {formatPrice(ticket.parchi_price!)} via Parchi
                        </span>
                      )}
                    </>
                  );
                })()}
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
                {(() => {
                  const pricing = getTicketPricing(ticket);
                  if (pricing.mode === "parchi") {
                    return (
                      <>
                        {pricing.comparePrice && (
                          <div className="text-sm text-muted-foreground line-through whitespace-nowrap">
                            {formatPrice(pricing.comparePrice)}
                          </div>
                        )}
                        <div className="text-3xl font-bold whitespace-nowrap text-[#0069DB]">
                          {formatPrice(pricing.salePrice)}
                        </div>
                        <div className="text-xs font-bold text-[#0069DB] bg-[#0069DB]/10 border border-[#0069DB]/20 px-2 py-0.5 rounded-full w-fit ml-auto mt-0.5">
                          Parchi Student Rate
                        </div>
                      </>
                    );
                  }
                  if (pricing.comparePrice) {
                    return (
                      <>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-muted-foreground line-through whitespace-nowrap">
                            {formatPrice(pricing.comparePrice)}
                          </span>
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            {Math.round(((pricing.comparePrice - pricing.salePrice) / pricing.comparePrice) * 100)}% OFF
                          </span>
                        </div>
                        <div className="text-3xl font-bold whitespace-nowrap text-emerald-400">
                          {formatPrice(pricing.salePrice)}
                        </div>
                        {pricing.hasParchiPrice && (
                          <div className="text-xs text-[#0069DB] mt-0.5">
                            Students: {formatPrice(ticket.parchi_price!)} via Parchi
                          </div>
                        )}
                      </>
                    );
                  }
                  return (
                    <>
                      <div className="text-3xl font-bold whitespace-nowrap">
                        {formatPrice(pricing.salePrice)}
                      </div>
                      {pricing.hasParchiPrice && (
                        <div className="text-xs text-[#0069DB] mt-0.5">
                          Students: {formatPrice(ticket.parchi_price!)} via Parchi
                        </div>
                      )}
                    </>
                  );
                })()}
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
        <div className="space-y-6 md:space-y-8">
          {ticketGroups.map((group, groupIdx) => {
            const groupKey = group.name || `ungrouped-${groupIdx}`;
            const isCollapsed = group.name ? !!collapsedGroups[group.name] : false;

            return (
              <div key={groupKey} className="space-y-3 md:space-y-4">
                {group.name ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name!)}
                    className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-card/80 hover:bg-card border border-border/80 hover:border-primary/40 rounded-2xl transition-all cursor-pointer group shadow-sm select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                      <h3 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-foreground text-left truncate">
                        {group.name}
                      </h3>
                      <Badge variant="secondary" className="text-xs shrink-0 font-medium">
                        {group.tickets.length} {group.tickets.length === 1 ? "pass" : "passes"}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      }`}
                    />
                  </button>
                ) : (
                  <div className="flex items-center gap-3 pb-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      General Passes
                    </h4>
                    <div className="h-px bg-border/60 flex-1" />
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key={`group-body-${groupKey}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <motion.div
                        className="grid gap-3 md:gap-6 pt-1 pb-1"
                        variants={cardGridVariants}
                      >
                        {group.tickets.map((ticket) => renderTicketCard(ticket))}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <motion.div className="grid gap-3 md:gap-6" variants={cardGridVariants}>
          {ticketTypes.map((ticket) => renderTicketCard(ticket))}
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
                  <span className="font-semibold text-foreground">
                    {formatPrice(getTotalPrice())}
                  </span>
                  {arrivedFromParchi && parchiEnabled && (
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
