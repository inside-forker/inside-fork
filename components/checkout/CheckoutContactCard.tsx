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
  editing,
  onEdit,
  buyerNotGoing,
}: {
  values: BuyerDetails;
  onChange: (field: keyof BuyerDetails, value: string) => void;
  errors?: Partial<Record<keyof BuyerDetails, string>>;
  /** Show name, email and phone as fields rather than read-only rows. */
  editing: boolean;
  onEdit: () => void;
  /** The buyer isn't holding ticket 1, so their name and CNIC live here. */
  buyerNotGoing: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-primary/5 p-3.5 ${editing ? "space-y-3.5" : "space-y-2.5"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Tickets and receipt go to</p>
        {editing ? null : (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-primary hover:opacity-80"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
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
          <CheckoutField
            label="Email Address"
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            error={errors?.email}
            id="contact-email"
          />
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
      ) : (
        <>
          {buyerNotGoing ? (
            <ContactRow icon={<User className="h-[15px] w-[15px]" />}>{values.name}</ContactRow>
          ) : null}
          <ContactRow icon={<Mail className="h-[15px] w-[15px]" />} strong>
            {values.email}
          </ContactRow>
          <ContactRow icon={<Smartphone className="h-[15px] w-[15px]" />}>
            {values.phone}
          </ContactRow>
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
