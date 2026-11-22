"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { DiscountBank, DiscountItem } from "@/lib/discounts/types";

export type BankLookup = Map<number, DiscountBank>;

/** The app's illustrated category icons, for deals without a photo. */
const CATEGORY_ICONS: Record<string, string> = {
  dining: "/assets/icons/food-and-drink.png",
  entertainment: "/assets/icons/things-to-do.png",
  shopping: "/assets/icons/shopping.png",
  beauty: "/assets/icons/salons.png",
  hotels: "/assets/icons/hotels.png",
  travel: "/assets/icons/things-to-do.png",
};

export function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? "/assets/icons/saved-deals.png";
}

/** A round bank logo; a white initials chip when the logo is missing or fails. */
export function BankLogo({ bank, className }: { bank: DiscountBank | undefined; className?: string }) {
  const [failed, setFailed] = useState(false);
  const base = cn("block shrink-0 rounded-full border border-border bg-white", className);
  if (!bank?.logo || failed) {
    const initials = (bank?.short ?? "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("")
      .toUpperCase();
    return (
      <span
        aria-hidden="true"
        className={cn(base, "flex items-center justify-center text-[7px] font-bold leading-none text-ink")}
      >
        {initials}
      </span>
    );
  }
  return (
    <Image
      src={bank.logo}
      alt=""
      width={40}
      height={40}
      onError={() => setFailed(true)}
      className={cn(base, "object-cover")}
    />
  );
}

function BankLogos({ ids, banks }: { ids: number[]; banks: BankLookup }) {
  if (ids.length === 0) return null;
  return (
    <span className="flex shrink-0">
      {ids.map((id, i) => (
        <BankLogo key={id} bank={banks.get(id)} className={cn("h-[18px] w-[18px]", i > 0 && "-ml-1.5")} />
      ))}
    </span>
  );
}

/** Bank logos and "Meezan · 24 branches". */
export function DealMeta({
  item,
  banks,
  className,
}: {
  item: DiscountItem;
  banks: BankLookup;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-muted-foreground", className)}>
      <BankLogos ids={item.logos} banks={banks} />
      <span className="truncate">{item.meta}</span>
    </span>
  );
}

/** "40% off" at text size, bold. Ranges read "Up to 20%". */
export function DealPercent({ item, className }: { item: DiscountItem; className?: string }) {
  if (item.percent == null) {
    return <span className={cn("block font-bold", className)}>{offerText(item)}</span>;
  }
  return (
    <span className={cn("block font-bold tracking-[-0.02em]", className)}>
      {item.upTo && <span className="mr-1 text-data font-semibold tracking-normal text-muted-foreground">Up to</span>}
      {item.percent}%<span className="ml-1 text-data font-semibold tracking-normal text-muted-foreground">off</span>
    </span>
  );
}

function offerText(item: DiscountItem): string {
  return /^special offer$/i.test(item.label) ? "Special offer" : item.label;
}

function DealPhoto({
  item,
  sizes,
  className,
  placeholder = "bg-muted",
}: {
  item: DiscountItem;
  sizes: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <span className={cn("relative block overflow-hidden", placeholder, className)}>
      {item.image ? (
        <Image
          src={item.image}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-slow ease-standard group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <Image src={categoryIcon(item.category)} alt="" width={56} height={56} className="h-11 w-11" />
        </span>
      )}
    </span>
  );
}

const CARD_FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/** Half off or more: a black card with the photo across the top. */
export function InkDealCard({
  item,
  banks,
  onOpen,
  className,
}: {
  item: DiscountItem;
  banks: BankLookup;
  onOpen: (item: DiscountItem) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "ds-tone-ink group block min-w-0 overflow-hidden rounded-media bg-background text-left text-foreground",
        CARD_FOCUS,
        className,
      )}
    >
      <DealPhoto
        item={item}
        sizes="(min-width: 1024px) 290px, 300px"
        placeholder="bg-cream/10"
        className="h-[140px] lg:h-40"
      />
      <span className="block px-3.5 pb-3.5 pt-3 lg:px-4 lg:pb-4 lg:pt-3.5">
        <DealPercent item={item} className="text-lg leading-[22px] lg:text-xl lg:leading-[26px]" />
        <span className="mt-[3px] block truncate text-[17px] font-bold leading-[22px] lg:text-lg lg:leading-6">
          {item.brand}
        </span>
        <DealMeta item={item} banks={banks} className="mt-1 text-data lg:text-small" />
      </span>
    </button>
  );
}

/** 40% off: a cream card with a shorter photo on top. */
export function CreamDealCard({
  item,
  banks,
  onOpen,
  className,
}: {
  item: DiscountItem;
  banks: BankLookup;
  onOpen: (item: DiscountItem) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "ds-tone-cream group block min-w-0 overflow-hidden rounded-media bg-background text-left text-foreground",
        CARD_FOCUS,
        className,
      )}
    >
      <DealPhoto item={item} sizes="(min-width: 1024px) 190px, 50vw" className="h-[100px] lg:h-[104px]" />
      <span className="block px-3 pb-3 pt-2.5 lg:px-3.5 lg:pb-3.5 lg:pt-3">
        <DealPercent item={item} className="text-[17px] leading-[22px] lg:text-lg lg:leading-6" />
        <span className="mt-0.5 block truncate text-[15px] font-bold leading-5 lg:text-base lg:leading-[22px]">
          {item.brand}
        </span>
        <DealMeta item={item} banks={banks} className="mt-1 text-label lg:text-data" />
      </span>
    </button>
  );
}

/** Everything else: a white row, % first and the photo on the right. */
export function DealRow({
  item,
  banks,
  onOpen,
}: {
  item: DiscountItem;
  banks: BankLookup;
  onOpen: (item: DiscountItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "group flex w-full min-w-0 items-center gap-3 border-b border-border py-2.5 text-left",
        CARD_FOCUS,
      )}
    >
      <span className="w-[46px] shrink-0 font-bold tracking-[-0.02em]">
        {item.percent == null ? (
          <span className="block text-data leading-4">{offerText(item)}</span>
        ) : (
          <>
            {item.upTo && (
              <span className="block text-label font-semibold tracking-normal text-muted-foreground">Up to</span>
            )}
            <span className="block text-[17px] leading-[22px]">{item.percent}%</span>
          </>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold leading-[22px]">{item.brand}</span>
        <DealMeta item={item} banks={banks} className="mt-1 text-data" />
      </span>
      <DealPhoto item={item} sizes="80px" className="h-[60px] w-20 shrink-0 rounded-control" />
    </button>
  );
}
