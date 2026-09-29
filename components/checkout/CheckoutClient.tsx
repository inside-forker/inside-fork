"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/context/cartStore";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowRight, ShoppingBag } from "lucide-react";
import { OrderSummary } from "./OrderSummary";
import { BuyerDetailsForm } from "./BuyerDetailsForm";
import { GuestDetailsForm } from "./GuestDetailsForm";
import { useToast } from "@/hooks/use-toast";
import { CheckoutSteps } from "./CheckoutSteps";
import { ResumeBookingCard } from "./ResumeBookingCard";
import type {
  ResumableBookingDTO,
  ResumableResponse,
} from "@/types/checkout-resume.types";

/** Per-tab record of a dismissed resume prompt. Booking id only - no PII. */
const RESUME_DISMISS_KEY = "ik:resume:dismissed";

export function CheckoutClient() {
  const router = useRouter();
  const { items, updateGuestInfo } = useCartStore();
  const { user, isLoading: isUserLoading } = useSupabaseUser();
  const { toast } = useToast();

  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventDetails, setEventDetails] = useState<
    Record<number, { require_guest_details: boolean }>
  >({});
  const [resumable, setResumable] = useState<ResumableBookingDTO | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [buyerDetails, setBuyerDetails] = useState({
    name: "",
    email: "",
    phone: "",
    cnic: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Fetch Event Details (for guest requirements)
  useEffect(() => {
    const fetchEvents = async () => {
      const eventIds = Array.from(new Set(items.map((i) => i.eventId)));
      if (eventIds.length === 0) return;

      try {
        const res = await fetch(
          `/api/checkout/events?ids=${eventIds.join(",")}`,
        );
        const result = await res.json();
        const data = result.events as
          | { id: number; require_guest_details: boolean }[]
          | undefined;

        if (data) {
          const map = data.reduce(
            (acc: Record<number, { require_guest_details: boolean }>, e) => ({
              ...acc,
              [e.id]: e,
            }),
            {},
          );
          setEventDetails(map);
        }
      } catch (error) {
        console.error("Failed to fetch event details", error);
      }
    };
    fetchEvents();
  }, [items]);

  // Look for an unfinished booking to offer resuming (only once on mount).
  //
  // Deliberately NOT gated on `items.length` any more. That gate is why this
  // never fired in the case it exists for: after a failed payment the cart is
  // empty, so the check bailed out and the user got a bare "Your cart is
  // empty" instead of the booking they had just tried to pay for. When the
  // cart does have items we still narrow by event, so a resumable booking for
  // what you're currently buying takes priority.
  const hasCheckedExistingBookings = useRef(false);
  useEffect(() => {
    const checkExistingBookings = async () => {
      if (!user || hasCheckedExistingBookings.current) return;
      hasCheckedExistingBookings.current = true;

      const eventIds = Array.from(new Set(items.map((i) => i.eventId)));
      const params = eventIds.length ? `?eventIds=${eventIds.join(",")}` : "";

      try {
        const res = await fetch(`/api/checkout/resumable${params}`);
        const result = (await res.json()) as ResumableResponse;

        // Expiry/eligibility is decided server-side now - re-checking
        // `expires_at` here is what used to suppress a perfectly resumable
        // booking whose short payment hold had lapsed.
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

  // Prefill User Details
  useEffect(() => {
    if (user) {
      setBuyerDetails((prev) => ({
        ...prev,
        name: user.full_name || "",
        email: user.email || "",
        phone: prev.phone || "",
      }));
    }
  }, [user]);

  // Redirect if cart is empty
  useEffect(() => {
    if (!isLoadingConfig && items.length === 0) {
      // router.push("/events"); // Uncomment to redirect
    }
  }, [items, isLoadingConfig, router]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Buyer Validation
    if (!buyerDetails.name.trim()) newErrors.buyerName = "Name is required";
    if (!buyerDetails.email.trim()) newErrors.buyerEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerDetails.email))
      newErrors.buyerEmail = "Invalid email format";
    if (!buyerDetails.phone.trim()) newErrors.buyerPhone = "Phone is required";

    // CNIC is required for buyer
    if (!buyerDetails.cnic?.trim()) {
      newErrors.buyerCnic = "CNIC is required";
    } else if (buyerDetails.cnic.length < 13) {
      newErrors.buyerCnic = "Invalid CNIC";
    }

    // Guest Validation
    items.forEach((item) => {
      const event = eventDetails[item.eventId];
      const systemRequire = config?.["ticketing.require_guest_details"];

      // Determine if guests are required
      const isRequired =
        systemRequire === "always" ||
        (systemRequire === "per_event" && event?.require_guest_details);

      if (isRequired) {
        for (let i = 0; i < item.quantity; i++) {
          const guest = item.guestInfo[i];
          if (!guest?.name?.trim()) {
            newErrors[`guest-${item.ticketTypeId}-${i}-name`] =
              "Name is required";
          }
          if (!guest?.cnic?.trim()) {
            newErrors[`guest-${item.ticketTypeId}-${i}-cnic`] =
              "CNIC is required";
          } else if (guest.cnic.length < 13) {
            newErrors[`guest-${item.ticketTypeId}-${i}-cnic`] = "Invalid CNIC";
          }
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      isValid = false;
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
    } else {
      setErrors({});
    }

    return isValid;
  };

  const handleProceed = async () => {
    // 1. Check Auth
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to complete your purchase.",
      });
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent("/checkout");
      router.push(`/login?next=${returnUrl}`);
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // 2. Create Booking via API
      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerDetails,
          items,
          fees: {
            platformFeeFixed: Number(config?.["fees.platform_fee_fixed"] || 0),
            platformFeePercentage: Number(
              config?.["fees.platform_fee_percentage"] || 0
            ),
            paymentFeeFixed: Number(
              config?.["fees.payment_processing_fee_fixed"] || 0
            ),
            paymentFeePercentage: Number(
              config?.["fees.payment_processing_fee_percentage"] || 0
            ),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create booking");
      }

      // 3. Redirect to payment. The cart is deliberately NOT cleared here:
      // creating the booking row is not payment, and wiping it at this point
      // is what left users with an empty cart after every failed attempt.
      // `CheckoutSuccessContent` clears it once payment is actually confirmed.
      router.push(`/checkout/payment?bookingId=${result.bookingId}`);
    } catch (error: unknown) {
      console.error("Booking error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingConfig || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Offer to resume an unfinished booking before showing the cart. The user
  // chooses - we never silently resume or silently discard.
  if (resumable) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold">Your cart is empty</h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Looks like you haven&apos;t added any tickets yet.
        </p>
        <Button onClick={() => router.push("/events")}>Browse Events</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CheckoutSteps currentStep="details" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Forms */}
        <div className="lg:col-span-8 space-y-8">
          {/* Buyer Details */}
          <Card className="border-2 border-primary/10 shadow-sm">
            <CardContent className="pt-6">
              <BuyerDetailsForm
                values={buyerDetails}
                onChange={(field, value) =>
                  setBuyerDetails((prev) => ({ ...prev, [field]: value }))
                }
                errors={{
                  name: errors.buyerName,
                  email: errors.buyerEmail,
                  phone: errors.buyerPhone,
                  cnic: errors.buyerCnic,
                }}
                readOnly={false}
              />
            </CardContent>
          </Card>

          {/* Guest Details */}
          {items.map((item) => {
            const event = eventDetails[item.eventId];
            const systemRequire = config?.["ticketing.require_guest_details"];
            const isRequired =
              systemRequire === "always" ||
              (systemRequire === "per_event" && event?.require_guest_details);

            if (!isRequired) return null;

            return (
              <Card
                key={item.ticketTypeId}
                className="border-2 border-primary/10 shadow-sm"
              >
                <CardContent className="pt-6 space-y-6">
                  <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {item.ticketName} - Guest Details
                  </h3>
                  <div className="space-y-6">
                    {Array.from({ length: item.quantity }).map((_, idx) => (
                      <GuestDetailsForm
                        key={`${item.ticketTypeId}-${idx}`}
                        item={item}
                        index={idx}
                        onChange={(field, value) =>
                          updateGuestInfo(item.ticketTypeId, idx, {
                            [field]: value,
                          })
                        }
                        errors={{
                          name: errors[
                            `guest-${item.ticketTypeId}-${idx}-name`
                          ],
                          cnic: errors[
                            `guest-${item.ticketTypeId}-${idx}-cnic`
                          ],
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 space-y-6 h-fit">
            <OrderSummary
              items={items}
              platformFeeFixed={Number(
                config?.["fees.platform_fee_fixed"] || 0
              )}
              platformFeePercentage={Number(
                config?.["fees.platform_fee_percentage"] || 0
              )}
              paymentFeeFixed={Number(
                config?.["fees.payment_processing_fee_fixed"] || 0
              )}
              paymentFeePercentage={Number(
                config?.["fees.payment_processing_fee_percentage"] || 0
              )}
            >
              <div className="space-y-4 pt-4">
                <Button
                  className="w-full text-lg py-6 rounded-xl bg-primary hover:bg-primary/90 active:opacity-80 transition-colors"
                  size="lg"
                  onClick={handleProceed}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Booking...
                    </>
                  ) : (
                    <>
                      Confirm & Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By proceeding, you agree to our Terms of Service and Privacy
                  Policy.
                </p>
              </div>
            </OrderSummary>
          </div>
        </div>
      </div>
    </div>
  );
}
