"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Lock, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/context/cartStore";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ResumeBookingCard } from "./ResumeBookingCard";
import { ParchiDiscountCard } from "./ParchiDiscountCard";
import {
  CheckoutTicketCard,
  type CheckoutEventInfo,
  type CheckoutTotals,
} from "./CheckoutTicketCard";
import {
  BuyerHolderCard,
  GuestHolderCard,
  type HolderInfo,
} from "./CheckoutHolderCards";
import { CheckoutContactCard, type BuyerDetails } from "./CheckoutContactCard";
import { digitsOnly, formatPhone, formatPkr } from "./checkoutFormat";
import {
  computeParchiDiscount,
  describeParchiOffer,
  type ParchiOffer,
} from "@/lib/parchi/discount";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";
import { isPrismfestSlug } from "@/lib/events/prismfest";
import { AuthModal } from "@/components/auth/AuthModal";
import type {
  ResumableBookingDTO,
  ResumableResponse,
} from "@/types/checkout-resume.types";

/** Per-tab record of a dismissed resume prompt. Booking id only - no PII. */
const RESUME_DISMISS_KEY = "ik:resume:dismissed";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type BuyerErrors = Partial<Record<keyof BuyerDetails, string>>;
type HolderErrors = Record<number, { name?: string; cnic?: string }>;
type ProfileInfo = {
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

function contactErrors(buyer: BuyerDetails): BuyerErrors {
  const errors: BuyerErrors = {};
  if (!buyer.name.trim()) errors.name = "Name is required";
  if (!EMAIL_PATTERN.test(buyer.email)) errors.email = "Enter a valid email";
  if (digitsOnly(buyer.phone).length < 11) errors.phone = "Enter a valid phone number";
  return errors;
}

/** "+923001234567" / "923001234567" / "03001234567" -> "0300-1234567". */
function phoneFromProfile(raw: string | null | undefined): string {
  const digits = digitsOnly(raw ?? "");
  const local =
    digits.startsWith("92") && digits.length === 12 ? `0${digits.slice(2)}` : digits;
  return formatPhone(local);
}

/**
 * Checkout details step - the same screen as the app's (insidekhi-reactnative
 * src/app/checkout/index.tsx): the order as a ticket, the Parchi discount,
 * "Who's going" (a name + CNIC per ticket, ticket 1 the buyer's by default),
 * contact details prefilled from the profile, and one pink pay button.
 */
export function CheckoutClient() {
  const router = useRouter();
  const { items, updateQuantity } = useCartStore();
  const { user, isLoading: isUserLoading } = useSupabaseUser();
  const { toast } = useToast();
  const userId = user?.id;
  const arrivedFromParchi = useArrivedFromParchi();

  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventInfo, setEventInfo] = useState<CheckoutEventInfo | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [resumable, setResumable] = useState<ResumableBookingDTO | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const [buyer, setBuyer] = useState<BuyerDetails>({
    name: "",
    email: "",
    phone: "",
    cnic: "",
  });
  const [buyerErrors, setBuyerErrors] = useState<BuyerErrors>({});
  // Ticket 1 is the buyer's until they say they aren't going.
  const [buyerHoldsFirst, setBuyerHoldsFirst] = useState(true);
  // Once the buyer has opened the contact fields they stay open.
  const [editingContact, setEditingContact] = useState(false);

  // One holder per ticket, in cart order - the order the booking API hands
  // guests out to ticket types.
  const slots = useMemo(
    () =>
      items.flatMap((item) =>
        Array.from({ length: item.quantity }, (_, index) => ({
          ticketTypeId: item.ticketTypeId,
          ticketName: item.ticketName,
          index,
        })),
      ),
    [items],
  );
  const slotCount = slots.length;
  const [guests, setGuests] = useState<HolderInfo[]>([]);
  const [guestErrors, setGuestErrors] = useState<HolderErrors>({});

  // The ticket card can change the ticket count, and a holder is a position
  // in this array - so it has to follow. Trailing slots go when the count
  // drops; the ones already filled stay put.
  useEffect(() => {
    setGuests((prev) => {
      if (prev.length === slotCount) return prev;
      const next = prev.slice(0, slotCount);
      while (next.length < slotCount) next.push({ name: "", cnic: "" });
      return next;
    });
    setGuestErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([index]) => Number(index) < slotCount),
      ),
    );
  }, [slotCount]);

  // Parchi student discount - only for single-event carts (bookings are
  // single-event anyway).
  const cartEventIds = Array.from(new Set(items.map((i) => i.eventId)));
  const parchiEventId = cartEventIds.length === 1 ? cartEventIds[0] : null;
  const [parchiOffer, setParchiOffer] = useState<ParchiOffer | null>(null);
  const [parchiVerificationId, setParchiVerificationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!parchiEventId) return;
    let cancelled = false;
    fetch(`/api/parchi/offer?eventId=${parchiEventId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.offer) setParchiOffer(data.offer);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [parchiEventId]);

  // Synchronously detect Prismfest carts right from the cart items
  const isPrismfestCart =
    isPrismfestSlug(eventInfo?.slug) ||
    items.some(
      (i) =>
        i.eventId === 101 ||
        (i.eventName && i.eventName.toLowerCase().includes("prism")),
    );

  const ikOpenStudentDiscount =
    !parchiVerificationId &&
    isPrismfestCart;

  // Same arithmetic as app/api/bookings/create/route.ts: student discount
  // comes off the subtotal, then fees on what's left.
  const totals: CheckoutTotals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let discount = 0;
    if (parchiOffer && parchiVerificationId) {
      discount = computeParchiDiscount(parchiOffer, subtotal);
    } else if (ikOpenStudentDiscount) {
      const offerToUse: ParchiOffer = parchiOffer ?? {
        discount_type: "percentage",
        discount_value: 20,
        max_discount_amount: null,
      };
      discount = computeParchiDiscount(offerToUse, subtotal);
    }
    const discounted = subtotal - discount;
    const platformFee =
      Number(config?.["fees.platform_fee_fixed"] || 0) +
      discounted * (Number(config?.["fees.platform_fee_percentage"] || 0) / 100);
    const paymentFee =
      Number(config?.["fees.payment_processing_fee_fixed"] || 0) +
      (discounted + platformFee) *
        (Number(config?.["fees.payment_processing_fee_percentage"] || 0) / 100);
    return {
      subtotal,
      discount,
      platformFee,
      paymentFee,
      total: discounted + platformFee + paymentFee,
    };
  }, [
    items,
    config,
    parchiOffer,
    parchiVerificationId,
    ikOpenStudentDiscount,
  ]);

  // Fetch Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/system/config");
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
      } catch (error) {
        console.error("Failed to load config", error);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  // What the ticket card shows: the event's name, night, venue and poster.
  const firstEventId = items[0]?.eventId;
  useEffect(() => {
    if (!firstEventId) return;
    let cancelled = false;
    fetch(`/api/checkout/events?ids=${firstEventId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const event = data?.events?.[0];
        if (!cancelled && event) setEventInfo(event);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [firstEventId]);

  // Look for an unfinished booking to offer resuming only when the cart is empty
  // (e.g. user returns after an aborted or failed payment).
  const hasCheckedExistingBookings = useRef(false);
  useEffect(() => {
    const checkExistingBookings = async () => {
      if (!user || items.length > 0 || hasCheckedExistingBookings.current) return;
      hasCheckedExistingBookings.current = true;

      const eventIds = Array.from(new Set(items.map((i) => i.eventId)));
      const params = eventIds.length ? `?eventIds=${eventIds.join(",")}` : "";

      try {
        const res = await fetch(`/api/checkout/resumable${params}`);
        const result = (await res.json()) as ResumableResponse;

        // Expiry/eligibility is decided server-side.
        if (result.booking) {
          const dismissed = sessionStorage.getItem(RESUME_DISMISS_KEY);
          if (dismissed !== String(result.booking.booking_id)) {
            setResumable(result.booking);
          }
        }
      } catch (error) {
        console.error("Failed to check for a resumable booking", error);
      }
    };

    checkExistingBookings();
  }, [user, items]);

  const handleResume = async () => {
    if (!resumable) return;
    setIsResuming(true);
    setResumeError(null);
    try {
      const res = await fetch(
        `/api/bookings/${resumable.booking_id}/resume-payment`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) {
        setResumeError(body?.error ?? "Couldn't resume this booking.");
        return;
      }
      router.push(`/checkout/payment?bookingId=${resumable.booking_id}`);
    } catch {
      setResumeError("Couldn't resume this booking. Please try again.");
    } finally {
      setIsResuming(false);
    }
  };

  const handleDismissResume = () => {
    if (resumable) {
      // Remember the choice for this tab so it doesn't re-prompt on every
      // navigation. Booking id only - no PII.
      sessionStorage.setItem(RESUME_DISMISS_KEY, String(resumable.booking_id));
    }
    setResumable(null);
  };

  // Prefill from the account and profile. Profile data can land after the
  // first render, so fill in only what is still empty - never over something
  // the buyer typed.
  useEffect(() => {
    if (!user) return;
    setBuyer((prev) => ({
      ...prev,
      name: prev.name || (user.full_name ?? "").trim(),
      email: (user.email ?? "").trim(),
    }));
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const p = data?.profile as ProfileInfo | undefined;
        if (cancelled || !p) return;
        setProfile(p);
        setBuyer((prev) => ({
          ...prev,
          name: prev.name || (p.full_name ?? "").trim(),
          email: (user.email ?? "").trim(),
          phone: prev.phone || phoneFromProfile(p.phone),
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.email]);

  // Judged on the account/profile rather than the live fields, so the card
  // doesn't fold back into read-only rows halfway through the buyer typing.
  const profileComplete =
    !!user &&
    Object.keys(
      contactErrors({
        name: profile?.full_name ?? user.full_name ?? "",
        email: user.email ?? "",
        phone: phoneFromProfile(profile?.phone),
        cnic: "",
      }),
    ).length === 0;
  const showContactFields = editingContact || (!!user && !profileComplete);

  const handleBuyerChange = (field: keyof BuyerDetails, value: string) => {
    if (field === "email" && user) return;
    setBuyer((prev) => ({ ...prev, [field]: value }));
    if (field !== "cnic") setEditingContact(true);
    if (buyerErrors[field]) {
      setBuyerErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleGuestChange = (
    index: number,
    field: keyof HolderInfo,
    value: string,
  ) => {
    setGuests((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    if (guestErrors[index]?.[field]) {
      setGuestErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: undefined },
      }));
    }
  };

  const isBuyerSlot = (index: number) => index === 0 && buyerHoldsFirst;

  const handleProceed = async (overrideUserCheck = false) => {
    if (!user && !overrideUserCheck) {
      setAuthOpen(true);
      return;
    }

    const effectiveName = (buyer.name.trim() || user?.full_name || user?.email?.split("@")[0] || "Guest").trim();
    const effectiveEmail = (user?.email || buyer.email).trim();
    const effectivePhone = (buyer.phone.trim() || profile?.phone || "").trim();

    const nextBuyerErrors: BuyerErrors = {};
    if (!effectiveName) {
      nextBuyerErrors.name = "Name is required";
    }

    const phoneDigits = digitsOnly(effectivePhone);
    if (!phoneDigits || phoneDigits.length < 11) {
      nextBuyerErrors.phone = "Mobile number is required (03XX-XXXXXXX)";
    }

    if (digitsOnly(buyer.cnic).length < 13) nextBuyerErrors.cnic = "Enter a valid CNIC";

    const nextGuestErrors: HolderErrors = {};
    guests.forEach((guest, index) => {
      if (isBuyerSlot(index)) return;
      const errors: { name?: string; cnic?: string } = {};
      if (!guest.name.trim()) errors.name = "Name is required";
      if (digitsOnly(guest.cnic).length < 13) errors.cnic = "Enter a valid CNIC";
      if (Object.keys(errors).length) nextGuestErrors[index] = errors;
    });

    setBuyerErrors(nextBuyerErrors);
    setGuestErrors(nextGuestErrors);

    if (Object.keys(nextBuyerErrors).length || Object.keys(nextGuestErrors).length) {
      if (nextBuyerErrors.phone) {
        toast({
          title: "Mobile number required",
          description: "Please enter your mobile number (03XX-XXXXXXX) to proceed.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your details",
          description: "Each ticket needs a valid CNIC.",
          variant: "destructive",
        });
      }
      return;
    }

    // Save phone to profile if it wasn't saved yet
    if (phoneDigits.length >= 11 && (!profile?.phone || profile.phone !== effectivePhone)) {
      fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: effectivePhone }),
      }).catch(() => {});
    }

    // A ticket the buyer holds carries the buyer's own name and CNIC.
    const holders = guests.map((guest, index) =>
      isBuyerSlot(index) ? { name: effectiveName, cnic: buyer.cnic } : guest,
    );
    const bookingItems = items.map((item) => {
      const guestInfo: Record<number, HolderInfo> = {};
      slots.forEach((slot, i) => {
        if (slot.ticketTypeId === item.ticketTypeId) guestInfo[slot.index] = holders[i];
      });
      return { ...item, guestInfo };
    });

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerDetails: {
            ...buyer,
            name: effectiveName,
            email: effectiveEmail,
            phone: effectivePhone,
          },
          items: bookingItems,
          parchiVerificationId,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create booking");
      }
      // The cart is deliberately NOT cleared here: creating the booking row
      // is not payment. `CheckoutSuccessContent` clears it once paid.
      router.push(`/checkout/payment?bookingId=${result.bookingId}`);
    } catch (error: unknown) {
      console.error("Booking error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingConfig || isUserLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Offer to resume an unfinished booking if the cart is empty.
  if (items.length === 0 && resumable) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center">
        <ResumeBookingCard
          booking={resumable}
          onResume={handleResume}
          onDismiss={handleDismissResume}
          isResuming={isResuming}
          error={resumeError}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="rounded-full bg-muted p-4">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold sm:text-2xl">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Pick an event and choose your tickets to check out.
        </p>
        <Button onClick={() => router.push("/events")}>Browse Events</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      {/* Back, then where this step sits: details, then PayFast. */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1 ? router.back() : router.push("/events")
          }
          aria-label="Go back"
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted transition-opacity hover:opacity-80"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
        </button>
        <div className="flex items-center gap-2" aria-label="Step 1 of 2, details">
          <span className="h-1 w-[18px] rounded-full bg-foreground" />
          <span className="h-1 w-[18px] rounded-full bg-border" />
          <span className="text-xs font-semibold text-muted-foreground">Details</span>
        </div>
      </div>

      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Checkout</h1>

      <CheckoutTicketCard
        items={items}
        event={eventInfo}
        totals={totals}
        discountLabel={
          ikOpenStudentDiscount ? "Inside Karachi Discount" : undefined
        }
        onChangeQuantity={updateQuantity}
      />

      {parchiOffer && parchiEventId && arrivedFromParchi ? (
        <ParchiDiscountCard
          eventId={parchiEventId}
          offer={parchiOffer}
          isLoggedIn={!!user}
          onLogin={() => setAuthOpen(true)}
          onApprovedChange={setParchiVerificationId}
        />
      ) : null}

      {ikOpenStudentDiscount ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">Inside Karachi Discount Applied</p>
          <p className="text-muted-foreground">
            Your 20% discount is included in the total.
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Attendee & Contact Details</h2>
          <p className="text-xs text-muted-foreground">
            {user
              ? "Each ticket requires a CNIC. Tickets and receipt will be sent to your contact info."
              : "Tickets and receipt will be linked to your account."}
          </p>
        </div>

        <CheckoutContactCard
          values={buyer}
          onChange={handleBuyerChange}
          errors={buyerErrors}
          ticketName={slots[0]?.ticketName ?? ""}
          avatarUrl={profile?.avatar_url ?? user?.avatar_url}
          buyerHoldsFirst={buyerHoldsFirst}
          onToggleBuyerHoldsFirst={() => setBuyerHoldsFirst((prev) => !prev)}
          isLoggedIn={!!user}
          onAuthRequest={() => setAuthOpen(true)}
        />

        {user && (!buyerHoldsFirst || slotCount > 1) ? (
          <div className="space-y-3 pt-1">
            {guests.map((guest, index) => {
              if (index === 0 && buyerHoldsFirst) return null;
              return (
                <GuestHolderCard
                  key={`guest-${index}`}
                  index={index}
                  ticketName={slots[index]?.ticketName ?? ""}
                  value={guest}
                  onChange={(field, value) => handleGuestChange(index, field, value)}
                  errors={guestErrors[index]}
                  onClaim={index === 0 ? () => setBuyerHoldsFirst(true) : undefined}
                />
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="space-y-1 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" />
          You pay on PayFast in the next step
        </p>
        <p className="text-[11px]">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      {/* The one pink action, kept in reach above the mobile bottom bar. */}
      <div className="sticky bottom-24 z-20 md:bottom-6">
        <button
          type="button"
          onClick={() => void handleProceed()}
          disabled={isSubmitting}
          aria-label={`Continue to payment, ${formatPkr(totals.total)}`}
          className="flex h-[54px] w-full items-center justify-between rounded-xl bg-primary px-[18px] text-primary-foreground shadow-lg shadow-primary/25 transition-opacity hover:opacity-95 active:opacity-90 disabled:opacity-70"
        >
          <span className="text-base font-bold">
            {isSubmitting ? "Creating booking…" : "Continue to payment"}
          </span>
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <span className="text-base font-bold tabular-nums">
              {formatPkr(totals.total)}
            </span>
          )}
        </button>
      </div>

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        nextPath="/checkout"
        onSuccess={() => {
          // Stay on the checkout page with account connected
        }}
        description={
          parchiOffer && isPrismfestSlug(eventInfo?.slug)
            ? `Sign in or create an Inside Karachi account to unlock your discount.`
            : "Sign in or create an account to complete your booking."
        }
      />
    </div>
  );
}
