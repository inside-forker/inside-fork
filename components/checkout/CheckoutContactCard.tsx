"use client";

import { Mail, Smartphone, User } from "lucide-react";
import { CheckoutField } from "./CheckoutField";
import { formatCnic, formatPhone } from "./checkoutFormat";

export type BuyerDetails = {
  name: string;
  email: string;
  phone: string;
  cnic: string;
};

/**
 * Where the tickets and receipt go (mirrors the app's CheckoutContactCard).
 * The profile's name, email and phone arrive filled in and read as a summary;
 * "Edit" opens them. The page opens them itself when one is missing or fails
 * validation.
 */
export function CheckoutContactCard({
  values,
  onChange,
  errors,
  buyerNotGoing,
  isLoggedIn = false,
  onAuthRequest,
}: {
  values: BuyerDetails;
  onChange: (field: keyof BuyerDetails, value: string) => void;
  errors?: Partial<Record<keyof BuyerDetails, string>>;
  editing?: boolean;
  onEdit?: () => void;
  /** The buyer isn't holding ticket 1, so their name and CNIC live here. */
  buyerNotGoing: boolean;
  isLoggedIn?: boolean;
  onAuthRequest?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-primary/5 p-3.5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Tickets and receipt go to</p>
      </div>

      {!isLoggedIn ? (
        <div className="flex items-center justify-between gap-3 pt-1">
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
          />
        </>
      )}

      {buyerNotGoing ? (
        <CheckoutField
          label="Your CNIC"
          value={values.cnic}
          onChange={(e) => onChange("cnic", formatCnic(e.target.value))}
          placeholder="42101-1234567-1"
          inputMode="numeric"
          maxLength={15}
          error={errors?.cnic}
          id="contact-cnic"
        />
      ) : null}
    </div>
  );
}

function ContactRow({
  icon,
  strong,
  children,
}: {
  icon: React.ReactNode;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className={`flex-1 truncate ${strong ? "font-semibold" : ""}`}>{children}</span>
    </div>
  );
}
