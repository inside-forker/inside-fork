"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Percent, Plus, Search } from "lucide-react";
import { Container } from "@/components/ds";
import { cn } from "@/lib/utils";
import type { DiscountBank, DiscountTab, SavedCardSummary } from "@/lib/discounts/types";
import { BankLogo, type BankLookup } from "@/components/discounts/DealCards";

const fmt = (n: number) => n.toLocaleString("en-US");
const offers = (n: number) => `${fmt(n)} ${n === 1 ? "offer" : "offers"}`;

/** The page column, the same as /events. */
export const DISCOUNTS_WRAP = "max-w-[1200px] px-5 sm:px-5 lg:px-8";

function SearchField({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">Search discounts</span>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search discounts"
        className="h-10 w-full rounded-full bg-muted pl-10 pr-4 text-small text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary lg:h-[42px]"
      />
    </label>
  );
}

function CardArt({ card, bank, className }: { card: SavedCardSummary; bank: DiscountBank | undefined; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-control bg-ink", className)}>
      {card.image ? (
        <Image src={card.image} alt="" fill sizes="72px" className="object-cover" />
      ) : (
        <BankLogo bank={bank} className="h-4 w-4" />
      )}
    </span>
  );
}

const STRIP_ITEM =
  "relative flex h-[38px] w-[60px] shrink-0 items-center justify-center rounded-control outline-none transition-shadow duration-fast focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:h-[46px] lg:w-[72px]";

function StripButton({
  on,
  label,
  onClick,
  className,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(STRIP_ITEM, on && "ring-2 ring-primary ring-offset-2", className)}
    >
      {children}
    </button>
  );
}

/**
 * The reader's cards as small card art on white: All discounts, both (or all)
 * cards, each card, then Add. The picked one gets a pink ring, and one line
 * under it names it.
 */
function CardStrip({
  cards,
  allCardsCount,
  totalOffers,
  tab,
  card,
  banks,
  onShowAll,
  onPickCard,
  onAddCard,
  onEditCards,
}: {
  cards: SavedCardSummary[];
  allCardsCount: number;
  totalOffers: number;
  tab: DiscountTab;
  card: number | null;
  banks: BankLookup;
  onShowAll: () => void;
  onPickCard: (cardVariantId: number | null) => void;
  onAddCard: () => void;
  onEditCards: () => void;
}) {
  const [a, b] = cards;
  const single = cards.length === 1;
  const forYou = tab === "for-you";
  const allName = cards.length === 2 ? "Both cards" : "All your cards";
  const pickedCard = card == null ? null : cards.find((c) => c.cardVariantId === card);
  const picked = !forYou
    ? { name: "All discounts", count: totalOffers }
    : pickedCard
      ? { name: pickedCard.name, count: pickedCard.count }
      : single
        ? { name: a.name, count: a.count }
        : { name: allName, count: allCardsCount };
  const art = "absolute h-[22px] w-[34px] lg:h-[27px] lg:w-[42px]";

  return (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
      <div role="group" aria-label="Your cards" className="scrollbar-hide -m-1 flex gap-2.5 overflow-x-auto p-1 lg:gap-3">
        <StripButton
          on={!forYou}
          label={`All discounts, ${offers(totalOffers)}`}
          onClick={onShowAll}
          className="bg-muted text-foreground"
        >
          <Percent className="h-[18px] w-[18px] lg:h-5 lg:w-5" aria-hidden="true" />
        </StripButton>
        {cards.length > 1 && (
          <StripButton
            on={forYou && card === null}
            label={`${allName}, ${offers(allCardsCount)}`}
            onClick={() => onPickCard(null)}
            className="bg-muted"
          >
            <CardArt card={b} bank={banks.get(b.bankId)} className={cn(art, "left-1.5 top-1")} />
            <CardArt card={a} bank={banks.get(a.bankId)} className={cn(art, "bottom-1 right-1.5 ring-2 ring-white")} />
          </StripButton>
        )}
        {cards.map((c) => (
          <StripButton
            key={c.id}
            on={forYou && (card === c.cardVariantId || (single && card === null))}
            label={`${c.name}, ${offers(c.count)}`}
            onClick={() => onPickCard(single ? null : c.cardVariantId)}
            className="overflow-hidden"
          >
            <CardArt card={c} bank={banks.get(c.bankId)} className="h-full w-full rounded-none" />
          </StripButton>
        ))}
        <button
          type="button"
          onClick={onAddCard}
          aria-label="Add a card"
          title="Add a card"
          className={cn(
            STRIP_ITEM,
            "border border-dashed border-ink/30 text-muted-foreground hover:border-ink/50 hover:text-foreground",
          )}
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
      <p className="text-data text-muted-foreground lg:text-small" aria-live="polite">
        <span className="font-semibold text-foreground">{picked.name}</span> · {offers(picked.count)}
        <button
          type="button"
          onClick={onEditCards}
          className="relative ml-2.5 font-semibold text-foreground underline underline-offset-[3px] outline-none before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] focus-visible:ring-2 focus-visible:ring-primary"
        >
          Edit cards
        </button>
      </p>
    </div>
  );
}

/** No saved cards (or signed out): bank logos, the offer count and the pink Add your card. */
function AddCardLine({
  signedIn,
  banks,
  stats,
  loginHref,
  addCardHref,
  onAddCard,
}: {
  signedIn: boolean;
  banks: DiscountBank[];
  stats: { offers: number; banks: number };
  loginHref: string;
  addCardHref: string;
  onAddCard: () => void;
}) {
  const logos = banks.filter((b) => b.logo).slice(0, 5);
  const addClass =
    "inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-small font-semibold text-primary-foreground outline-none transition-opacity duration-fast hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:h-9";
  const add = (
    <>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add your card
    </>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      {logos.length > 0 && (
        <span className="flex shrink-0" aria-hidden="true">
          {logos.map((b, i) => (
            <BankLogo key={b.id} bank={b} className={cn("h-7 w-7 border-2 border-white", i > 0 && "-ml-2")} />
          ))}
        </span>
      )}
      <p className="min-w-0 flex-1 text-data text-muted-foreground lg:flex-none lg:text-[15px]">
        {fmt(stats.offers)} offers from {stats.banks} banks and wallets
      </p>
      <div className="flex w-full items-center gap-4 lg:ml-1 lg:w-auto">
        {signedIn ? (
          <button type="button" onClick={onAddCard} className={addClass}>
            {add}
          </button>
        ) : (
          <>
            <Link href={addCardHref} className={addClass}>
              {add}
            </Link>
            <Link href={loginHref} className="text-small font-semibold underline underline-offset-[3px]">
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The top of /discounts on white, built like /events: the title, search and
 * filter menus, then the reader's cards as a small strip of card art (or one
 * Add your card line). `children` holds the filter status and errors.
 */
export function DiscountsHeader({
  tab,
  card,
  signedIn,
  cards,
  allCardsCount,
  stats,
  search,
  onSearch,
  onShowAll,
  onPickCard,
  onAddCard,
  onEditCards,
  banks,
  bankList,
  loginHref,
  addCardHref,
  filters,
  children,
}: {
  tab: DiscountTab;
  card: number | null;
  signedIn: boolean;
  cards: SavedCardSummary[];
  allCardsCount: number;
  stats: { offers: number; banks: number };
  search: string;
  onSearch: (value: string) => void;
  onShowAll: () => void;
  onPickCard: (cardVariantId: number | null) => void;
  onAddCard: () => void;
  onEditCards: () => void;
  banks: BankLookup;
  bankList: DiscountBank[];
  loginHref: string;
  addCardHref: string;
  /** The filter menus. */
  filters: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Container className={cn(DISCOUNTS_WRAP, "pt-4 lg:pt-8")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 lg:gap-x-4">
        <h1 className="order-1 text-[22px] font-bold leading-7 tracking-[-0.02em] lg:text-3xl lg:leading-9">
          <span className="lg:hidden">Discounts</span>
          <span className="hidden lg:inline">Discounts in Karachi</span>
        </h1>
        <SearchField
          value={search}
          onChange={onSearch}
          className="order-2 flex-1 lg:order-3 lg:ml-auto lg:w-[300px] lg:flex-none"
        />
        <div
          role="group"
          aria-label="Filter discounts"
          className="order-3 flex w-full flex-wrap gap-2 lg:order-2 lg:ml-4 lg:w-auto"
        >
          {filters}
        </div>
      </div>
      <div className="mt-4 lg:mt-5">
        {cards.length > 0 ? (
          <CardStrip
            cards={cards}
            allCardsCount={allCardsCount}
            totalOffers={stats.offers}
            tab={tab}
            card={card}
            banks={banks}
            onShowAll={onShowAll}
            onPickCard={onPickCard}
            onAddCard={onAddCard}
            onEditCards={onEditCards}
          />
        ) : (
          <AddCardLine
            signedIn={signedIn}
            banks={bankList}
            stats={stats}
            loginHref={loginHref}
            addCardHref={addCardHref}
            onAddCard={onAddCard}
          />
        )}
      </div>
      {children}
    </Container>
  );
}
