"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DISCOUNT_CATEGORIES, type DiscountDetail, type DiscountItem } from "@/lib/discounts/types";
import { BankLogo, DealPercent, categoryIcon, type BankLookup } from "@/components/discounts/DealCards";
import { Panel } from "@/components/discounts/Panel";

function endsLabel(days: number | null): string | null {
  if (days == null || days > 60) return null;
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}

const SUBHEAD = "text-label font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * The deal sheet: the offer, then (loaded on open) which banks and cards it
 * takes with each bank's terms, and the place or every branch of a chain.
 */
export function DealSheet({
  item,
  detailHref,
  banks,
  onClose,
}: {
  item: DiscountItem | null;
  /** GET /api/discounts?…&detail=key for the open item, scoped like the page. */
  detailHref: string | null;
  banks: BankLookup;
  onClose: () => void;
}) {
  return (
    <Panel
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title={item ? `${item.brand} discount` : "Discount"}
    >
      {item && <SheetBody key={item.key} item={item} detailHref={detailHref} banks={banks} />}
    </Panel>
  );
}

function SheetBody({
  item,
  detailHref,
  banks,
}: {
  item: DiscountItem;
  detailHref: string | null;
  banks: BankLookup;
}) {
  const [detail, setDetail] = useState<DiscountDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!detailHref) return;
    let cancelled = false;
    fetch(detailHref, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { item: DiscountDetail }) => {
        if (!cancelled) setDetail(body.item);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [detailHref]);

  const category = DISCOUNT_CATEGORIES.find((c) => c.value === item.category)?.label;
  const ends = endsLabel(item.endsInDays);
  const meta = [category, item.branchCount > 1 ? `${item.branchCount} branches` : null].filter(Boolean);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative h-40 shrink-0 bg-muted lg:h-48">
          {item.image ? (
            <Image src={item.image} alt="" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center">
              <Image src={categoryIcon(item.category)} alt="" width={72} height={72} className="h-16 w-16" />
            </span>
          )}
        </div>

        <div className="px-5 pb-6 pt-4 lg:px-6">
          <DealPercent item={item} className="text-[22px] leading-7" />
          <h2 className="mt-0.5 text-xl font-bold leading-[26px] tracking-[-0.01em]">{item.brand}</h2>
          {(meta.length > 0 || ends) && (
            <p className="mt-1 text-data text-muted-foreground">
              {meta.join(" · ")}
              {ends && (
                <>
                  {meta.length > 0 && " · "}
                  <span className="font-semibold text-foreground">{ends}</span>
                </>
              )}
            </p>
          )}

          <h3 className={`mt-5 ${SUBHEAD}`}>Pay with</h3>
          {detail ? (
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {detail.offers.map((offer) => {
                const bank = offer.bankId != null ? banks.get(offer.bankId) : undefined;
                const cards =
                  offer.cards.length === 0
                    ? `Any ${bank?.short ?? "bank"} card`
                    : offer.cards.length > 4
                      ? `${offer.cards.slice(0, 4).join(", ")} and ${offer.cards.length - 4} more`
                      : offer.cards.join(", ");
                const off =
                  offer.percent == null ? offer.label : `${offer.upTo ? "Up to " : ""}${offer.percent}% off`;
                return (
                  <li key={`${offer.bankId}-${offer.percent ?? offer.label}-${offer.upTo}`} className="py-3">
                    <div className="flex items-center gap-2.5">
                      <BankLogo bank={bank} className="h-7 w-7" />
                      <div className="min-w-0 flex-1">
                        <p className="text-small font-semibold">{bank?.name ?? "Partner card"}</p>
                        <p className="text-data text-muted-foreground">{cards}</p>
                      </div>
                      <span className="shrink-0 text-small font-bold">{off}</span>
                    </div>
                    {offer.terms &&
                      (detail.offers.length > 1 ? (
                        <details className="group mt-1.5 pl-[38px]">
                          <summary className="flex min-h-8 cursor-pointer list-none items-center text-data font-semibold underline underline-offset-[3px] [&::-webkit-details-marker]:hidden">
                            <span className="group-open:hidden">Terms</span>
                            <span className="hidden group-open:inline">Hide terms</span>
                          </summary>
                          <p className="mt-1 whitespace-pre-line text-data text-muted-foreground">{offer.terms}</p>
                        </details>
                      ) : (
                        <p className="mt-2 whitespace-pre-line text-data text-muted-foreground">{offer.terms}</p>
                      ))}
                  </li>
                );
              })}
            </ul>
          ) : failed ? (
            <p className="mt-2 text-data text-muted-foreground">
              The offer details didn&apos;t load. Close this and try again.
            </p>
          ) : (
            <div className="mt-2 space-y-2" aria-busy="true" aria-label="Loading offers">
              <div className="h-12 rounded-control bg-muted" />
              <div className="h-12 rounded-control bg-muted" />
            </div>
          )}
          <p className="mt-2 text-label text-muted-foreground">
            Each bank sets its own terms. Check them before you pay.
          </p>

          {detail && detail.branches.length > 1 && (
            <>
              <h3 className={`mt-5 ${SUBHEAD}`}>Branches</h3>
              <ul className="mt-1 divide-y divide-border">
                {detail.branches.map((branch, i) =>
                  branch.slug ? (
                    <li key={`${branch.slug}-${i}`}>
                      <Link
                        href={`/listing/${branch.slug}`}
                        className="flex min-h-11 items-center justify-between gap-3 py-2 text-small font-medium outline-none transition-colors duration-fast hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="truncate">{branch.label ?? item.brand}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </>
          )}
        </div>
      </div>

      {item.slug && (
        <div className="shrink-0 border-t border-border px-5 py-3 lg:px-6 lg:py-4">
          <Link
            href={`/listing/${item.slug}`}
            className="flex h-12 items-center justify-center rounded-full bg-primary text-body font-semibold text-primary-foreground outline-none transition-opacity duration-fast hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            View place
          </Link>
        </div>
      )}
    </>
  );
}
