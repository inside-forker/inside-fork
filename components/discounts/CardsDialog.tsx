"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscountBank, SavedCardSummary } from "@/lib/discounts/types";
import { BankLogo } from "@/components/discounts/DealCards";
import { Panel, PanelHeading } from "@/components/discounts/Panel";

export type CardsDialogMode = "add" | "manage" | null;

interface CardVariant {
  id: number;
  name: string;
  detail: string;
  image: string | null;
}

function CardThumb({ image, bank }: { image: string | null; bank: DiscountBank | undefined }) {
  return (
    <span className="relative flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-control bg-ink">
      {image ? (
        <Image src={image} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <BankLogo bank={bank} className="h-5 w-5" />
      )}
    </span>
  );
}

/**
 * The reader's card wallet: "Your cards" (remove) and "Add a card" (pick a
 * bank, then the card). Cards live in `user_cards`, shared with the app.
 */
export function CardsDialog({
  mode,
  onModeChange,
  cards,
  banks,
  onChanged,
}: {
  mode: CardsDialogMode;
  onModeChange: (mode: CardsDialogMode) => void;
  cards: SavedCardSummary[];
  banks: DiscountBank[];
  /** After an add (with the new card's variant id) or a removal. */
  onChanged: (addedCardVariantId?: number) => void;
}) {
  return (
    <Panel
      open={mode !== null}
      onOpenChange={(open) => !open && onModeChange(null)}
      title={mode === "manage" ? "Your cards" : "Add a card"}
      fixedHeight={mode === "add"}
    >
      {mode === "add" && (
        <AddCard
          cards={cards}
          banks={banks}
          onAdded={(id) => {
            onModeChange(null);
            onChanged(id);
          }}
        />
      )}
      {mode === "manage" && (
        <ManageCards cards={cards} banks={banks} onAdd={() => onModeChange("add")} onRemoved={() => onChanged()} />
      )}
    </Panel>
  );
}

function ManageCards({
  cards,
  banks,
  onAdd,
  onRemoved,
}: {
  cards: SavedCardSummary[];
  banks: DiscountBank[];
  onAdd: () => void;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState<number | null>(null);
  const [removed, setRemoved] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const visible = cards.filter((c) => !removed.includes(c.id));

  const remove = async (card: SavedCardSummary) => {
    setRemoving(card.id);
    setError(null);
    try {
      const res = await fetch(`/api/user-cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setRemoved((r) => [...r, card.id]);
      onRemoved();
    } catch {
      setError("Couldn't remove the card. Try again.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <PanelHeading>
        <h2 className="text-xl font-bold leading-[26px] tracking-[-0.01em]">Your cards</h2>
        <p className="mt-1 text-data text-muted-foreground">Offers for these cards show under For you.</p>
      </PanelHeading>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 lg:px-6">
        {visible.length === 0 ? (
          <p className="py-6 text-small text-muted-foreground">No cards yet.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {visible.map((card) => (
              <li key={card.id} className="flex items-center gap-3 py-3">
                <CardThumb image={card.image} bank={banks.find((b) => b.id === card.bankId)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold">{card.name}</p>
                  <p className="text-data text-muted-foreground">
                    {card.count.toLocaleString("en-US")} {card.count === 1 ? "offer" : "offers"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(card)}
                  disabled={removing !== null}
                  className="flex h-11 items-center px-2 text-small font-semibold text-muted-foreground underline underline-offset-[3px] outline-none transition-colors duration-fast hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  {removing === card.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-data text-destructive">{error}</p>}
      </div>
      <div className="shrink-0 border-t border-border px-5 py-3 lg:px-6 lg:py-4">
        <button
          type="button"
          onClick={onAdd}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-body font-semibold text-primary-foreground outline-none transition-opacity duration-fast hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          Add a card
        </button>
      </div>
    </>
  );
}

function AddCard({
  cards,
  banks,
  onAdded,
}: {
  cards: SavedCardSummary[];
  banks: DiscountBank[];
  onAdded: (cardVariantId: number) => void;
}) {
  const [bank, setBank] = useState<DiscountBank | null>(null);
  const [variants, setVariants] = useState<CardVariant[] | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bank) return;
    let cancelled = false;
    setVariants(null);
    setError(null);
    fetch(`/api/cards?bankId=${bank.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { cards?: Array<Record<string, unknown>> }) => {
        if (cancelled) return;
        setVariants(
          (body.cards ?? []).map((c) => ({
            id: Number(c.id),
            name: String(c.card_name ?? "Card"),
            detail: [
              ...new Set(
                [c.card_type, c.card_network, c.card_tier]
                  .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
                  .map((v) => v.trim().charAt(0).toUpperCase() + v.trim().slice(1)),
              ),
            ].join(" · "),
            image: typeof c.image_filename === "string" && c.image_filename ? c.image_filename : null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this bank's cards. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [bank]);

  const save = async (variant: CardVariant) => {
    setSaving(variant.id);
    setError(null);
    try {
      const res = await fetch("/api/user-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardVariantId: variant.id }),
      });
      if (res.status === 409) throw new Error("This card is already in your wallet.");
      if (res.status === 401) throw new Error("Sign in again to add a card.");
      if (!res.ok) throw new Error("Couldn't add the card. Try again.");
      onAdded(variant.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the card. Try again.");
      setSaving(null);
    }
  };

  if (!bank) {
    return (
      <>
        <PanelHeading>
          <h2 className="text-xl font-bold leading-[26px] tracking-[-0.01em]">Add a card</h2>
          <p className="mt-1 text-data text-muted-foreground">
            Pick your bank, then your card. We only save the card&apos;s name, never its number.
          </p>
        </PanelHeading>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 lg:px-6 lg:pb-6">
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {banks.map((b) => (
              <li key={b.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setBank(b)}
                  className="flex h-14 w-full items-center gap-2.5 rounded-media bg-muted px-3 text-left outline-none transition-colors duration-fast hover:bg-border focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <BankLogo bank={b} className="h-8 w-8" />
                  <span className="min-w-0 truncate text-small font-semibold">{b.short}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  const savedIds = new Set(cards.map((c) => c.cardVariantId));
  return (
    <>
      <PanelHeading className="pt-3 lg:pt-4">
        <button
          type="button"
          onClick={() => setBank(null)}
          className="-ml-2 flex h-11 items-center gap-1 rounded-control px-2 text-small font-semibold outline-none transition-colors duration-fast hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Banks
        </button>
        <div className="mt-1 flex items-center gap-2.5">
          <BankLogo bank={bank} className="h-8 w-8" />
          <h2 className="truncate text-xl font-bold leading-[26px] tracking-[-0.01em]">{bank.name}</h2>
        </div>
        <p className="mt-1 text-data text-muted-foreground">Pick your card.</p>
      </PanelHeading>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 lg:px-6 lg:pb-6">
        {error && <p className="mb-3 text-data text-destructive">{error}</p>}
        {variants === null && !error ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading cards" />
          </div>
        ) : variants && variants.length === 0 ? (
          <p className="py-6 text-small text-muted-foreground">No cards listed for this bank yet.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {(variants ?? []).map((v) => {
              const saved = savedIds.has(v.id);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => save(v)}
                    disabled={saved || saving !== null}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 py-2.5 text-left outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-primary",
                      !saved && "hover:bg-muted",
                      saved && "cursor-default",
                    )}
                  >
                    <CardThumb image={v.image} bank={bank} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-small font-semibold">{v.name}</span>
                      {v.detail && <span className="block text-data text-muted-foreground">{v.detail}</span>}
                    </span>
                    {saved ? (
                      <span className="shrink-0 text-data font-semibold text-muted-foreground">Added</span>
                    ) : saving === v.id ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-label="Adding" />
                    ) : (
                      <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
