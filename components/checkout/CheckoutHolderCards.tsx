"use client";

import { Ticket } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckoutField } from "./CheckoutField";
import { formatCnic } from "./checkoutFormat";

export type HolderInfo = { name: string; cnic: string };

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
}: {
  name: string;
  avatarUrl?: string | null;
  ticketName: string;
  cnic: string;
  onChangeCnic: (value: string) => void;
  error?: string;
  onHandOff: () => void;
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
    </HolderFrame>
  );
}

/**
 * A ticket held by someone other than the buyer. On ticket 1 - the one the
 * buyer handed off - "It's me" takes it back.
 */
export function GuestHolderCard({
  index,
  ticketName,
  value,
  onChange,
  errors,
  onClaim,
}: {
  index: number;
  ticketName: string;
  value: HolderInfo;
  onChange: (field: keyof HolderInfo, value: string) => void;
  errors?: { name?: string; cnic?: string };
  onClaim?: () => void;
}) {
  return (
    <HolderFrame>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Ticket className="h-[17px] w-[17px] text-primary" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Ticket {index + 1} · Guest</p>
          <p className="truncate text-xs text-muted-foreground">{ticketName}</p>
        </div>
        {onClaim ? <CardLink label="It's me" onClick={onClaim} /> : null}
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
    </HolderFrame>
  );
}
