"use client";

import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckoutField } from "./CheckoutField";
import { formatCnic, formatPhone } from "./checkoutFormat";

export type BuyerDetails = {
  name: string;
  email: string;
  phone: string;
  cnic: string;
};

export function CheckoutContactCard({
  values,
  onChange,
  errors,
  ticketName,
  avatarUrl,
  buyerHoldsFirst = true,
  onToggleBuyerHoldsFirst,
  isLoggedIn = false,
  onAuthRequest,
}: {
  values: BuyerDetails;
  onChange: (field: keyof BuyerDetails, value: string) => void;
  errors?: Partial<Record<keyof BuyerDetails, string>>;
  ticketName?: string;
  avatarUrl?: string | null;
  buyerHoldsFirst?: boolean;
  onToggleBuyerHoldsFirst?: () => void;
  isLoggedIn?: boolean;
  onAuthRequest?: () => void;
}) {
  const display = values.name.trim() || "You";

  return (
    <div className="rounded-2xl bg-primary/5 p-4 space-y-4">
      {!isLoggedIn ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Sign in or create account
              </p>
              <p className="text-xs text-muted-foreground">
                Tickets and receipt will be linked to your account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAuthRequest}
            className="shrink-0 rounded-xl bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
          >
            Sign in
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-xs font-semibold">
                  {display.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{display}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {buyerHoldsFirst
                    ? `You · ${ticketName || "Ticket 1"}`
                    : "Buyer (Not attending)"}
                </p>
              </div>
            </div>
            {onToggleBuyerHoldsFirst ? (
              <button
                type="button"
                onClick={onToggleBuyerHoldsFirst}
                className="text-xs font-semibold text-primary hover:opacity-80"
              >
                {buyerHoldsFirst ? "Not going?" : "It's me"}
              </button>
            ) : null}
          </div>

          <CheckoutField
            label="Full Name"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
            error={errors?.name}
            id="contact-name"
          />

          <div className="space-y-1">
            <CheckoutField
              label="Email Address"
              value={values.email}
              readOnly
              disabled
              tabIndex={-1}
              className="bg-muted/70 text-muted-foreground/80 cursor-not-allowed select-none border-border"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              error={errors?.email}
              id="contact-email"
            />
            <p className="text-[11px] text-muted-foreground/70">
              Account email cannot be changed
            </p>
          </div>

          <CheckoutField
            label="Phone"
            value={values.phone}
            onChange={(e) => onChange("phone", formatPhone(e.target.value))}
            placeholder="03XX-XXXXXXX"
            type="tel"
            autoComplete="tel"
            maxLength={12}
            error={errors?.phone}
            id="contact-phone"
            required
          />

          <CheckoutField
            label={buyerHoldsFirst ? "Your CNIC" : "Buyer's CNIC"}
            value={values.cnic}
            onChange={(e) => onChange("cnic", formatCnic(e.target.value))}
            placeholder="42101-1234567-1"
            inputMode="numeric"
            maxLength={15}
            error={errors?.cnic}
            id="contact-cnic"
            required
          />
        </>
      )}
    </div>
  );
}
