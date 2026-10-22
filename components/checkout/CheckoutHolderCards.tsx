"use client";

import { Ticket } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckoutField } from "./CheckoutField";
import { formatCnic } from "./checkoutFormat";
import type { AttendeeField } from "@/lib/ticketing/attendee-fields";

/** answers: the organizer's extra questions, by field id. */
export type HolderInfo = {
  name: string;
  cnic: string;
  answers?: Record<string, string>;
};

/**
 * The organizer's extra questions ("University name", "Student ID"), drawn
 * in the checkout's one field shape. A dropdown gets the same box.
 */
export function AttendeeFieldInputs({
  fields,
  values,
  onChange,
  errors,
  idPrefix,
}: {
  fields: AttendeeField[];
  values?: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  errors?: Record<string, string | undefined>;
  idPrefix: string;
}) {
  return (
    <>
      {fields.map((field) => {
        const id = `${idPrefix}-${field.id}`;
        const label = field.required ? field.label : `${field.label} (optional)`;
        const value = values?.[field.id] ?? "";
        const error = errors?.[field.id];
        if (field.type === "select") {
          return (
            <div key={field.id} className="flex-1 space-y-2">
              <label htmlFor={id} className="block text-sm font-semibold">
                {label}
              </label>
              <select
                id={id}
                value={value}
                onChange={(e) => onChange(field.id, e.target.value)}
                aria-invalid={!!error}
                className={`w-full rounded-lg border bg-muted px-3.5 py-3 text-sm text-foreground outline-none focus:border-foreground/30 ${
                  error ? "border-destructive" : "border-border"
                }`}
              >
                <option value="">Select…</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          );
        }
        return (
          <CheckoutField
            key={field.id}
            id={id}
            label={label}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
            inputMode={
              field.type === "number" || field.type === "phone" ? "numeric" : undefined
            }
            error={error}
          />
        );
      })}
    </>
  );
}

/** Once-per-booking questions, in their own card under "Who's going". */
export function OrderFieldsCard({
  fields,
  values,
  onChange,
  errors,
}: {
  fields: AttendeeField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  errors?: Record<string, string | undefined>;
}) {
  if (fields.length === 0) return null;
  return (
    <HolderFrame>
      <p className="text-sm font-semibold">Booking details</p>
      <AttendeeFieldInputs
        fields={fields}
        values={values}
        onChange={onChange}
        errors={errors}
        idPrefix="order"
      />
    </HolderFrame>
  );
}

/** The frame both holder cards share: one ticket, one card. */
function HolderFrame({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3.5 rounded-2xl border bg-card p-3.5">{children}</div>;
}

function CardLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-xs font-semibold text-primary hover:opacity-80"
    >
      {label}
    </button>
  );
}

/**
 * Ticket 1, held by the buyer (mirrors the app). Their name is already known,
 * so the only thing left to type is their CNIC. "Not going?" hands the ticket
 * to a guest.
 */
export function BuyerHolderCard({
  name,
  avatarUrl,
  ticketName,
  cnic,
  onChangeCnic,
  error,
  onHandOff,
  fields = [],
  answers,
  onChangeAnswer,
  answerErrors,
}: {
  name: string;
  avatarUrl?: string | null;
  ticketName: string;
  cnic: string;
  onChangeCnic: (value: string) => void;
  error?: string;
  onHandOff: () => void;
  /** The organizer's per-person questions. */
  fields?: AttendeeField[];
  answers?: Record<string, string>;
  onChangeAnswer?: (fieldId: string, value: string) => void;
  answerErrors?: Record<string, string | undefined>;
}) {
  const display = name.trim() || "You";
  return (
    <HolderFrame>
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-xs font-semibold">
            {display.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{display}</p>
          <p className="truncate text-xs text-muted-foreground">You · {ticketName}</p>
        </div>
        <CardLink label="Not going?" onClick={onHandOff} />
      </div>
      <CheckoutField
        label="Your CNIC"
        value={cnic}
        onChange={(e) => onChangeCnic(formatCnic(e.target.value))}
        placeholder="42101-1234567-1"
        inputMode="numeric"
        maxLength={15}
        error={error}
        id="holder-buyer-cnic"
      />
      {fields.length && onChangeAnswer ? (
        <AttendeeFieldInputs
          fields={fields}
          values={answers}
          onChange={onChangeAnswer}
          errors={answerErrors}
          idPrefix="holder-buyer"
        />
      ) : null}
    </HolderFrame>
  );
}

/**
 * A ticket held by someone other than the buyer. On ticket 1 - the one the
 * buyer handed off - "It's me" takes it back.
 */
export function GuestHolderCard({
  index,
  heading,
  ticketName,
  value,
  onChange,
  errors,
  onClaim,
  onRemove,
  fields = [],
  onChangeAnswer,
  answerErrors,
}: {
  index: number;
  /** Overrides "Ticket N · Guest", e.g. "Ticket 1 · Person 2 of 3". */
  heading?: string;
  ticketName: string;
  value: HolderInfo;
  onChange: (field: "name" | "cnic", value: string) => void;
  errors?: { name?: string; cnic?: string };
  onClaim?: () => void;
  /** Takes an optional group member off the ticket again. */
  onRemove?: () => void;
  /** The organizer's per-person questions. */
  fields?: AttendeeField[];
  onChangeAnswer?: (fieldId: string, value: string) => void;
  answerErrors?: Record<string, string | undefined>;
}) {
  return (
    <HolderFrame>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Ticket className="h-[17px] w-[17px] text-primary" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {heading ?? `Ticket ${index + 1} · Guest`}
          </p>
          <p className="truncate text-xs text-muted-foreground">{ticketName}</p>
        </div>
        {onClaim ? <CardLink label="It's me" onClick={onClaim} /> : null}
        {onRemove ? <CardLink label="Remove" onClick={onRemove} /> : null}
      </div>
      <CheckoutField
        label="Full name"
        value={value.name}
        onChange={(e) => onChange("name", e.target.value)}
        placeholder="Guest's full name"
        error={errors?.name}
        id={`holder-${index}-name`}
      />
      <CheckoutField
        label="CNIC"
        value={value.cnic}
        onChange={(e) => onChange("cnic", formatCnic(e.target.value))}
        placeholder="42101-1234567-1"
        inputMode="numeric"
        maxLength={15}
        error={errors?.cnic}
        id={`holder-${index}-cnic`}
      />
      {fields.length && onChangeAnswer ? (
        <AttendeeFieldInputs
          fields={fields}
          values={value.answers}
          onChange={onChangeAnswer}
          errors={answerErrors}
          idPrefix={`holder-${index}`}
        />
      ) : null}
    </HolderFrame>
  );
}
