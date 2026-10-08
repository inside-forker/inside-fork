"use client";

import { Minus, Plus } from "lucide-react";
import type { CartItem } from "@/lib/context/cartStore";
import { formatEventWhen, formatPkr } from "./checkoutFormat";

export interface CheckoutEventInfo {
  name: string;
  slug?: string | null;
  start_time: string | null;
  location_name: string | null;
  image_url: string | null;
}

export interface CheckoutTotals {
  subtotal: number;
  /** Parchi student or Inside Karachi discount, off the subtotal before fees. */
  discount: number;
  platformFee: number;
  paymentFee: number;
  total: number;
}

/**
 * The order, drawn as the ticket it buys (mirrors the app's CheckoutTicket):
 * the event poster heads it with the night and the venue, the ticket lines
 * sit on the dark stub with their own steppers, and a perforation separates
 * what you're buying from what it costs. Dark rather than pink: the only
 * pink on this step is the pay button.
 */
export function CheckoutTicketCard({
  items,
  event,
  totals,
  discountLabel = "Parchi student discount",
  onChangeQuantity,
}: {
  items: CartItem[];
  event: CheckoutEventInfo | null;
  totals: CheckoutTotals;
  discountLabel?: string;
  onChangeQuantity: (ticketTypeId: number, quantity: number) => void;
}) {
  const ticketCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const name = event?.name ?? items[0]?.eventName ?? "Your order";
  const when = event?.start_time ? formatEventWhen(event.start_time) : "";

  return (
    <div className="overflow-hidden rounded-2xl bg-[#111827] text-white">
      <div
        className="relative flex flex-col justify-end"
        style={event?.image_url ? { aspectRatio: "16 / 9" } : undefined}
      >
        {event?.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          </>
        ) : null}
        <div className="relative space-y-1 p-4 pt-5">
          {when ? (
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-white/75">
              {when}
            </p>
          ) : null}
          <h2 className="line-clamp-2 text-xl font-bold leading-tight">{name}</h2>
          {event?.location_name ? (
            <p className="truncate text-xs text-white/75">{event.location_name}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3.5 px-4 pb-3.5 pt-[18px]">
        {items.map((item) => (
          <TicketLine
            key={item.ticketTypeId}
            item={item}
            onChangeQuantity={onChangeQuantity}
          />
        ))}
      </div>

      <Perforation />

      <div className="space-y-3 px-4 pb-[18px] pt-1.5">
        <div className="space-y-1">
          <FeeRow label="Subtotal" amount={totals.subtotal} />
          {totals.discount > 0 ? (
            <FeeRow label={discountLabel} amount={totals.discount} minus />
          ) : null}
          {totals.platformFee > 0 ? (
            <FeeRow label="Platform fee" amount={totals.platformFee} />
          ) : null}
          {totals.paymentFee > 0 ? (
            <FeeRow label="Processing fee" amount={totals.paymentFee} />
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-white/60">
            {ticketCount} TICKET{ticketCount === 1 ? "" : "S"}
          </span>
          <span className="text-[28px] font-bold leading-none tabular-nums">
            {formatPkr(totals.total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function FeeRow({
  label,
  amount,
  minus,
}: {
  label: string;
  amount: number;
  minus?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 text-xs text-white/60">
      <span>{label}</span>
      <span className="tabular-nums">
        {minus ? "- " : ""}
        {formatPkr(amount)}
      </span>
    </div>
  );
}

/** Two half-circle notches cut to the page colour, and a dashed tear between them. */
function Perforation() {
  return (
    <div className="relative flex h-5 items-center">
      <div className="absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-background" />
      <div className="absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-background" />
      <div className="mx-[18px] w-full border-t-[1.5px] border-dashed border-white/25" />
    </div>
  );
}

function TicketLine({
  item,
  onChangeQuantity,
}: {
  item: CartItem;
  onChangeQuantity: (ticketTypeId: number, quantity: number) => void;
}) {
  const atMax = item.maxQuantity != null && item.quantity >= item.maxQuantity;
  const atMin = item.quantity <= 1;

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-semibold">{item.ticketName}</p>
        <p className="text-xs tabular-nums text-white/60">
          {formatPkr(item.price)}
          {atMax ? " · max reached" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <StepButton
          disabled={atMin}
          label={`One fewer ${item.ticketName}`}
          onClick={() => onChangeQuantity(item.ticketTypeId, item.quantity - 1)}
        >
          <Minus className="h-4 w-4" strokeWidth={2.5} />
        </StepButton>
        <span className="min-w-4 text-center text-base font-bold tabular-nums">
          {item.quantity}
        </span>
        <StepButton
          disabled={atMax}
          label={`One more ${item.ticketName}`}
          onClick={() => onChangeQuantity(item.ticketTypeId, item.quantity + 1)}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white/15 transition-opacity hover:bg-white/25 active:opacity-70 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
