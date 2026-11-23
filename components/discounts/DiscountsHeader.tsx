"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgePercent, Plus, Search } from "lucide-react";
import { Container } from "@/components/ds";
import { cn } from "@/lib/utils";
import type { DiscountBank, DiscountTab, SavedCardSummary } from "@/lib/discounts/types";
import { BankLogo, type BankLookup } from "@/components/discounts/DealCards";

const fmt = (n: number) => n.toLocaleString("en-US");

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
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded bg-ink", className)}>
      {card.image ? (
        <Image src={card.image} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <BankLogo bank={bank} className="h-4 w-4" />
      )}
    </span>
  );
}

const TILE =
  "flex h-14 w-full min-w-0 items-center gap-2.5 rounded-media px-3 text-left outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:h-16 lg:w-auto lg:max-w-[280px] lg:gap-3 lg:pl-3 lg:pr-5";

/** A homepage bank-picker tile: art, a name and its offer count. Pink when picked. */
function Tile({
  on,
  onClick,
  art,
  title,
  count,
}: {
  on: boolean;
  onClick: () => void;
  art: ReactNode;
  title: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(TILE, on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-border")}
    >
      {art}
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-bold leading-[18px] lg:text-[15px] lg:leading-5">{title}</span>
        <span className={cn("block text-label lg:text-data", on ? "text-primary-foreground" : "text-muted-foreground")}>
          {fmt(count)} {count === 1 ? "offer" : "offers"}
        </span>
      </span>
    </button>
  );
}

/** All discounts, both (or all) cards, each card, then Add a card. */
function Wallet({
  cards,
  allCardsCount,
  totalOffers,
  tab,
  card,
  banks,
  onShowAll,
  onPickCard,
  onAddCard,
  editCards,
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
  editCards: ReactNode;
}) {
  const [a, b] = cards;
  const artSize = "h-[26px] w-10 lg:h-[31px] lg:w-12";
  return (
    <div role="group" aria-label="Your cards" className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center lg:gap-2.5">
      <Tile
        on={tab === "all"}
        onClick={onShowAll}
        title="All discounts"
        count={totalOffers}
        art={
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-control bg-white text-ink lg:h-9 lg:w-9">
            <BadgePercent className="h-[18px] w-[18px] lg:h-5 lg:w-5" aria-hidden="true" />
          </span>
        }
      />
      {cards.length > 1 && (
        <Tile
          on={tab === "for-you" && card === null}
          onClick={() => onPickCard(null)}
          title={cards.length === 2 ? "Both cards" : "All your cards"}
          count={allCardsCount}
          art={
            <span className="relative h-[30px] w-10 shrink-0 lg:h-9 lg:w-12">
              <CardArt card={b} bank={banks.get(b.bankId)} className="absolute left-0 top-0 h-[21px] w-8 lg:h-6 lg:w-[38px]" />
              <CardArt
                card={a}
                bank={banks.get(a.bankId)}
                className="absolute bottom-0 right-0 h-[21px] w-8 ring-2 ring-white lg:h-6 lg:w-[38px]"
              />
            </span>
          }
        />
      )}
      {cards.map((c) => (
        <Tile
          key={c.id}
          on={tab === "for-you" && (card === c.cardVariantId || (cards.length === 1 && card === null))}
          onClick={() => onPickCard(cards.length === 1 ? null : c.cardVariantId)}
          title={c.name}
          count={c.count}
          art={<CardArt card={c} bank={banks.get(c.bankId)} className={artSize} />}
        />
      ))}
      <button
        type="button"
        onClick={onAddCard}
        className={cn(
          TILE,
          "justify-center gap-2 border border-dashed border-ink/25 text-[13.5px] font-bold hover:border-ink/50 lg:px-5 lg:text-[15px]",
        )}
      >
        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
        Add a card
      </button>
      {editCards}
    </div>
  );
}

/** No saved cards (or signed out): one line and the pink Add a card. */
function AddCardLine({
  signedIn,
  loginHref,
  addCardHref,
  onAddCard,
}: {
  signedIn: boolean;
  loginHref: string;
  addCardHref: string;
  onAddCard: () => void;
}) {
  const addClass =
    "inline-flex h-10 items-center rounded-full bg-primary px-5 text-small font-semibold text-primary-foreground outline-none transition-opacity duration-fast hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
      <span
        aria-hidden="true"
        className="flex h-7 w-11 shrink-0 items-center justify-center rounded border border-dashed border-ink/30 text-muted-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </span>
      <p className="min-w-0 flex-1 text-small leading-5 lg:flex-none lg:text-body">
        <span className="font-semibold">Your cards, your offers.</span>{" "}
        <span className="text-muted-foreground">Add a card and we show only what it unlocks.</span>
      </p>
      <div className="flex w-full items-center gap-4 lg:ml-1.5 lg:w-auto">
        {signedIn ? (
          <button type="button" onClick={onAddCard} className={addClass}>
            Add a card
          </button>
        ) : (
          <>
            <Link href={addCardHref} className={addClass}>
              Add a card
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
 * The top of /discounts, built like /events: the title and search on one row,
 * the filter menus, and the reader's cards as homepage bank-picker tiles (or
 * one Add a card line). `children` holds the filter status and errors.
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
  loginHref: string;
  addCardHref: string;
  /** The filter menus. */
  filters: ReactNode;
  children?: ReactNode;
}) {
  const hasCards = cards.length > 0;
  const editCards = (className: string) => (
    <button
      type="button"
      onClick={onEditCards}
      className={cn(
        "h-11 items-center px-1 text-data font-semibold underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary lg:text-small",
        className,
      )}
    >
      Edit cards
    </button>
  );

  return (
    <Container className={cn(DISCOUNTS_WRAP, "pb-2 pt-4 lg:pb-4 lg:pt-8")}>
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
        <div className="order-3 w-full lg:order-4 lg:mt-2">
          {hasCards ? (
            <Wallet
              cards={cards}
              allCardsCount={allCardsCount}
              totalOffers={stats.offers}
              tab={tab}
              card={card}
              banks={banks}
              onShowAll={onShowAll}
              onPickCard={onPickCard}
              onAddCard={onAddCard}
              editCards={editCards("hidden lg:ml-1 lg:inline-flex")}
            />
          ) : (
            <AddCardLine signedIn={signedIn} loginHref={loginHref} addCardHref={addCardHref} onAddCard={onAddCard} />
          )}
        </div>
        <div
          role="group"
          aria-label="Filter discounts"
          className="order-4 flex w-full flex-wrap items-center gap-2 lg:order-2 lg:ml-4 lg:w-auto"
        >
          {filters}
          {hasCards && editCards("ml-auto inline-flex lg:hidden")}
        </div>
      </div>
      {children}
    </Container>
  );
}
