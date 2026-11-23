"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lock, Plus, Search } from "lucide-react";
import { Container, Section } from "@/components/ds";
import { cn } from "@/lib/utils";
import type { DiscountBank, DiscountTab, SavedCardSummary } from "@/lib/discounts/types";
import { BankLogo, type BankLookup } from "@/components/discounts/DealCards";

const fmt = (n: number) => n.toLocaleString("en-US");

function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
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
        placeholder={placeholder}
        className="h-10 w-full rounded-full bg-cream/10 pl-10 pr-4 text-small text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary lg:h-[42px]"
      />
    </label>
  );
}

function TabButton({
  on,
  locked,
  onClick,
  children,
}: {
  on: boolean;
  locked?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        // The pill is 30px on phones; the ::before stretches the tap area to 44px.
        "relative inline-flex h-[30px] items-center gap-1.5 rounded-full px-3.5 text-data font-semibold outline-none transition-colors duration-fast before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-[''] focus-visible:ring-2 focus-visible:ring-primary lg:h-9 lg:px-4 lg:text-small",
        on ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-cream/10",
      )}
    >
      {locked && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

function CardArt({ card, bank, className }: { card: SavedCardSummary; bank: DiscountBank | undefined; className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden rounded-control bg-cream/10", className)}>
      {card.image ? (
        <Image src={card.image} alt="" fill sizes="150px" className="object-cover" />
      ) : (
        <span className="flex h-full w-full flex-col justify-between p-2.5">
          <BankLogo bank={bank} className="h-6 w-6" />
          <span className="line-clamp-2 text-label font-semibold text-foreground">{card.name}</span>
        </span>
      )}
    </span>
  );
}

function WalletTile({
  on,
  onClick,
  art,
  caption,
  count,
}: {
  on: boolean;
  onClick: () => void;
  art: ReactNode;
  caption: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="group w-[150px] shrink-0 snap-start rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      {art}
      <span
        className={cn(
          "mt-2 block truncate text-data font-semibold transition-colors duration-fast",
          on ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {caption}
      </span>
      <span className={cn("block text-label", on ? "text-muted-foreground" : "text-muted-foreground/70")}>
        {fmt(count)} {count === 1 ? "offer" : "offers"}
      </span>
      <span
        aria-hidden="true"
        className={cn("mt-[7px] block h-[3px] w-7 rounded-full", on ? "bg-primary" : "bg-transparent")}
      />
    </button>
  );
}

/** Saved cards as card art: "Both cards", each card, then Add a card. Tapping one filters For you. */
function Wallet({
  cards,
  allCardsCount,
  tab,
  card,
  banks,
  onPickCard,
  onAddCard,
}: {
  cards: SavedCardSummary[];
  allCardsCount: number;
  tab: DiscountTab;
  card: number | null;
  banks: BankLookup;
  onPickCard: (cardVariantId: number | null) => void;
  onAddCard: () => void;
}) {
  const [a, b] = cards;
  return (
    <div className="scrollbar-hide -mx-5 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 lg:mx-0 lg:scroll-px-0 lg:px-0 xl:flex-wrap xl:overflow-visible">
      {cards.length > 1 && (
        <WalletTile
          on={tab === "for-you" && card === null}
          onClick={() => onPickCard(null)}
          caption={cards.length === 2 ? "Both cards" : "All cards"}
          count={allCardsCount}
          art={
            <span className="relative block h-[94px] w-[150px]">
              <CardArt card={b} bank={banks.get(b.bankId)} className="absolute left-0 top-0 h-[74px] w-[118px]" />
              <CardArt
                card={a}
                bank={banks.get(a.bankId)}
                className="absolute left-8 top-5 h-[74px] w-[118px] border-2 border-ink"
              />
            </span>
          }
        />
      )}
      {cards.map((c) => (
        <WalletTile
          key={c.id}
          on={tab === "for-you" && (card === c.cardVariantId || (cards.length === 1 && card === null))}
          onClick={() => onPickCard(cards.length === 1 ? null : c.cardVariantId)}
          caption={c.name}
          count={c.count}
          art={<CardArt card={c} bank={banks.get(c.bankId)} className="h-[94px] w-[150px]" />}
        />
      ))}
      <button
        type="button"
        onClick={onAddCard}
        className="flex h-[94px] w-[150px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-cream/25 text-data font-semibold text-foreground outline-none transition-colors duration-fast hover:border-cream/50 focus-visible:ring-2 focus-visible:ring-primary xl:hidden"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Add a card
      </button>
    </div>
  );
}

/** No saved cards (or signed out): an empty card slot and the pink Add a card. */
function AddCardPrompt({
  signedIn,
  banks,
  bankCount,
  loginHref,
  addCardHref,
  onAddCard,
}: {
  signedIn: boolean;
  banks: DiscountBank[];
  bankCount: number;
  loginHref: string;
  addCardHref: string;
  onAddCard: () => void;
}) {
  const addClass =
    "inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-small font-semibold text-primary-foreground outline-none transition-opacity duration-fast hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:h-11 lg:px-[22px] lg:text-[15px]";
  const slotClass =
    "flex h-[60px] w-24 shrink-0 flex-col items-center justify-center gap-2.5 rounded-control border border-dashed border-cream/25 text-small font-semibold text-foreground outline-none transition-colors duration-fast hover:border-cream/50 focus-visible:ring-2 focus-visible:ring-primary lg:h-[132px] lg:w-[210px] lg:rounded-media";
  const slotInner = (
    <>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream/10 lg:h-11 lg:w-11">
        <Plus className="h-[18px] w-[18px] lg:h-5 lg:w-5" aria-hidden="true" />
      </span>
      <span className="hidden lg:block">Your card goes here</span>
    </>
  );

  return (
    <div className="flex items-center gap-4 lg:gap-6">
      {signedIn ? (
        <button type="button" onClick={onAddCard} aria-label="Add a card" className={slotClass}>
          {slotInner}
        </button>
      ) : (
        <Link href={addCardHref} aria-label="Add a card" className={slotClass}>
          {slotInner}
        </Link>
      )}
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-5 lg:text-[22px] lg:leading-[1.2] lg:tracking-[-0.015em]">
          Your cards, your offers
        </p>
        <p className="mt-1 text-data text-muted-foreground lg:mt-1.5 lg:text-[15px] lg:leading-[1.45]">
          Add a card and we show only what it unlocks, best first.
        </p>
        <div className="mt-3 hidden items-center gap-2.5 lg:flex">
          <span className="flex">
            {banks.slice(0, 5).map((b, i) => (
              <BankLogo key={b.id} bank={b} className={cn("h-7 w-7 border-2 border-ink", i > 0 && "-ml-2")} />
            ))}
          </span>
          <span className="text-data text-muted-foreground">{bankCount} banks and wallets</span>
        </div>
        <div className="mt-3 flex items-center gap-4 lg:mt-4">
          {signedIn ? (
            <button type="button" onClick={onAddCard} className={addClass}>
              Add a card
            </button>
          ) : (
            <>
              <Link href={addCardHref} className={addClass}>
                Add a card
              </Link>
              <Link
                href={loginHref}
                className="text-small font-semibold text-foreground underline underline-offset-[3px] lg:text-[15px]"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The black band at the top of /discounts: title, search, For you / All and
 * the reader's cards (or an Add a card prompt). `children` continue the band
 * (the filters and the half-off row), so the page reads black, cream, white.
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
  onTab,
  onPickCard,
  onAddCard,
  onEditCards,
  banks,
  bankList,
  loginHref,
  addCardHref,
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
  onTab: (tab: DiscountTab) => void;
  onPickCard: (cardVariantId: number | null) => void;
  onAddCard: () => void;
  onEditCards: () => void;
  banks: BankLookup;
  bankList: DiscountBank[];
  loginHref: string;
  addCardHref: string;
  children?: ReactNode;
}) {
  const hasCards = cards.length > 0;
  const editCards = (className: string) => (
    <button
      type="button"
      onClick={onEditCards}
      className={cn(
        "h-11 text-data font-semibold text-foreground underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      Edit cards
    </button>
  );

  return (
    <Section as="div" tone="ink" size="sm" className="pb-7 pt-5 md:pb-7 md:pt-5 lg:pb-12 lg:pt-10">
      <Container className="max-w-[1200px] px-5 sm:px-5 lg:px-8 xl:grid xl:grid-cols-[minmax(0,1fr)_560px] xl:items-center xl:gap-14">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold leading-7 tracking-[-0.02em] lg:text-[40px] lg:leading-[1.1] lg:tracking-[-0.03em]">
              <span className="lg:hidden">Discounts</span>
              <span className="hidden lg:inline">Discounts in Karachi</span>
            </h1>
            <SearchField value={search} onChange={onSearch} placeholder="Search discounts" className="flex-1 lg:hidden" />
          </div>
          <p className="mt-2 hidden text-body text-muted-foreground lg:block">
            {fmt(stats.offers)} offers from {stats.banks} banks and wallets
          </p>
          <div className="mt-3.5 flex items-center justify-between gap-3 lg:mt-6 lg:justify-start">
            <div role="group" aria-label="Discount lists" className="inline-flex gap-0.5 rounded-full bg-cream/10 p-[3px]">
              <TabButton on={tab === "for-you"} locked={!hasCards} onClick={() => onTab("for-you")}>
                For you
              </TabButton>
              <TabButton on={tab === "all"} onClick={() => onTab("all")}>
                All
              </TabButton>
            </div>
            <SearchField
              value={search}
              onChange={onSearch}
              placeholder="Search places, banks or cards"
              className="hidden lg:block lg:w-[340px]"
            />
            {hasCards && editCards("lg:ml-auto xl:hidden")}
          </div>
        </div>

        <div className="mt-4 min-w-0 lg:mt-7 xl:mt-0">
          {hasCards ? (
            <>
              <Wallet
                cards={cards}
                allCardsCount={allCardsCount}
                tab={tab}
                card={card}
                banks={banks}
                onPickCard={onPickCard}
                onAddCard={onAddCard}
              />
              <div className="mt-1 hidden items-center gap-5 xl:flex">
                <button
                  type="button"
                  onClick={onAddCard}
                  className="h-11 text-data font-semibold text-foreground underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Add a card
                </button>
                {editCards("")}
              </div>
            </>
          ) : (
            <AddCardPrompt
              signedIn={signedIn}
              banks={bankList}
              bankCount={stats.banks}
              loginHref={loginHref}
              addCardHref={addCardHref}
              onAddCard={onAddCard}
            />
          )}
        </div>
      </Container>
      {children}
    </Section>
  );
}
