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
  "rounded-media outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** "50% off", "Up to 20% off" or the offer's own label, as the homepage writes it. */
export function offerLabel(item: DiscountItem): string {
  if (item.percent == null) return offerText(item);
  return `${item.upTo ? "Up to " : ""}${item.percent}% off`;
}

/**
 * The homepage's deal card: the photo, then the offer, the place in bold and
 * one grey line of banks and branches. Colours follow the band it sits on.
 */
export function DealCard({
  item,
  banks,
  onOpen,
  sizes,
  photoClassName = "aspect-video",
  nameClassName = "text-body leading-[22px] lg:text-[17px] lg:leading-6",
  placeholder,
  className,
}: {
  item: DiscountItem;
  banks: BankLookup;
  onOpen: (item: DiscountItem) => void;
  sizes: string;
  photoClassName?: string;
  nameClassName?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn("group block min-w-0 text-left text-foreground", CARD_FOCUS, className)}
    >
      <DealPhoto item={item} sizes={sizes} placeholder={placeholder} className={cn("w-full rounded-media", photoClassName)} />
      <span className="mt-2.5 block text-small font-semibold leading-5 lg:text-[15px]">{offerLabel(item)}</span>
      <span className={cn("block truncate font-bold", nameClassName)}>{item.brand}</span>
      <DealMeta item={item} banks={banks} className="mt-0.5 text-data" />
    </button>
  );
}

/** The homepage's deal row: a small photo on the left, then the offer, the place and the banks. */
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
      className={cn("group flex w-full min-w-0 items-center gap-3 text-left text-foreground", CARD_FOCUS)}
    >
      <DealPhoto item={item} sizes="88px" className="h-[66px] w-[88px] shrink-0 rounded-media" />
      <span className="min-w-0 flex-1">
        <span className="block text-small font-semibold leading-5">{offerLabel(item)}</span>
        <span className="block truncate text-[15px] font-bold leading-5">{item.brand}</span>
        <DealMeta item={item} banks={banks} className="mt-0.5 text-label lg:text-data" />
      </span>
    </button>
  );
}
