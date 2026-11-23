"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Container, Section } from "@/components/ds";
import { FilterMenu, type FilterMenuOption } from "@/components/events/list/FilterMenu";
import { useAuthLinks } from "@/lib/auth/return-to";
import { AUTH_CHANGED_EVENT } from "@/lib/auth/client-events";
import { cn } from "@/lib/utils";
import {
  DISCOUNT_CATEGORIES,
  NO_DISCOUNT_FILTERS,
  discountViewToQuery,
  type DiscountBank,
  type DiscountFilters,
  type DiscountItem,
  type DiscountMenu,
  type DiscountTier,
  type DiscountView,
  type DiscountsResult,
} from "@/lib/discounts/types";
import { DealCard, DealRow, type BankLookup } from "@/components/discounts/DealCards";
import { DealSheet } from "@/components/discounts/DealSheet";
import { CardsDialog, type CardsDialogMode } from "@/components/discounts/CardsDialog";
import { DISCOUNTS_WRAP, DiscountsHeader } from "@/components/discounts/DiscountsHeader";

const fmt = (n: number) => n.toLocaleString("en-US");

const TIER_TITLES: Record<DiscountTier, string> = {
  half: "Half off or more",
  forty: "40% off",
  rest: "More discounts",
};

const PILL_BUTTON =
  "flex h-11 w-full items-center justify-center rounded-full bg-muted text-small font-semibold outline-none transition-colors duration-fast hover:bg-border focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";

/** "Half off or more  137        See all →": the small header every section uses. */
function SectionHead({
  id,
  title,
  count,
  onSeeAll,
}: {
  id: string;
  title: string;
  count: number;
  onSeeAll?: () => void;
}) {
  return (
    <div className="mb-3.5 flex items-baseline gap-2 lg:mb-4">
      <h2 id={id} className="text-[17px] font-bold leading-[22px] tracking-[-0.01em] lg:text-xl lg:leading-[26px]">
        {title}
      </h2>
      <span className="text-small font-semibold text-muted-foreground lg:text-[15px]">{fmt(count)}</span>
      {onSeeAll && (
        <button
          type="button"
          onClick={onSeeAll}
          aria-label={`See all: ${title}`}
          className="relative ml-auto inline-flex items-center gap-1 rounded-control text-small font-semibold outline-none before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] focus-visible:ring-2 focus-visible:ring-primary lg:text-[15px]"
        >
          See all
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Menu options, keeping a picked value visible even when nothing matches it any more. */
function menuOptions(menu: DiscountMenu, value: string | null, label: (v: string) => string): FilterMenuOption[] {
  if (!value || menu.options.some((o) => o.value === value)) return menu.options;
  return [...menu.options, { value, label: label(value), count: 0 }];
}

/**
 * /discounts (round 12 "C"): the /events top on white with the reader's card
 * strip, then a short black band holding only the half-off deals, then 40%
 * off cards and every other deal as rows, on white. "See all" opens one
 * section as a grid.
 */
export function DiscountsBrowser({
  initialData,
  initialView,
  banks,
  openAddCard,
}: {
  initialData: DiscountsResult;
  initialView: DiscountView;
  banks: DiscountBank[];
  /** Back from signing in via Add a card (`?add=1`). */
  openAddCard: boolean;
}) {
  const { loginHref } = useAuthLinks();
  const addCardHref = `/login?next=${encodeURIComponent("/discounts?add=1")}`;
  const bankLookup: BankLookup = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);

  const [view, setView] = useState<DiscountView>(initialView);
  const [search, setSearch] = useState(initialView.filters.search);
  const [data, setData] = useState<DiscountsResult>(initialData);
  const [more, setMore] = useState<{ items: DiscountItem[]; page: number }>({ items: [], page: 1 });
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [openItem, setOpenItem] = useState<DiscountItem | null>(null);
  const [cardsMode, setCardsMode] = useState<CardsDialogMode>(() =>
    openAddCard && initialData.signedIn ? "add" : null,
  );
  const listTop = useRef<HTMLDivElement>(null);

  const query = discountViewToQuery(view);
  const queryRef = useRef(query);
  queryRef.current = query;

  // Search waits for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => {
      setView((v) => (v.filters.search === search ? v : { ...v, filters: { ...v.filters, search } }));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Refetch when the view changes. The first view came from the server.
  const lastLoaded = useRef(`${query}#0`);
  useEffect(() => {
    const key = `${query}#${reload}`;
    if (key === lastLoaded.current) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/discounts${query}`, { signal: ctrl.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((next: DiscountsResult) => {
        lastLoaded.current = key;
        setData(next);
        setMore({ items: [], page: 1 });
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setError("Discounts didn't load. Try again.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [query, reload]);

  // Keep the URL in step so a filtered list can be shared or reloaded.
  useEffect(() => {
    const next = `${window.location.pathname}${query}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [query]);

  // Signing in or out elsewhere on the page changes the wallet.
  useEffect(() => {
    const onAuth = () => setReload((r) => r + 1);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuth);
  }, []);

  const setFilters = (patch: Partial<DiscountFilters>) =>
    setView((v) => ({ ...v, filters: { ...v.filters, ...patch } }));
  const clearFilters = () => {
    setSearch("");
    setView((v) => ({ ...v, filters: NO_DISCOUNT_FILTERS }));
  };

  const showForYou = (card: number | null) =>
    setView((v) => ({ ...v, tab: "for-you", card, tier: null, filters: { ...v.filters, bank: null } }));

  const showAll = () => setView((v) => ({ ...v, tab: "all", card: null, tier: null }));

  const openTier = (tier: DiscountTier | null) => {
    setView((v) => ({ ...v, tier }));
    // Bring the list back under the fixed site header if it has scrolled away.
    requestAnimationFrame(() => {
      const top = listTop.current;
      if (top && top.getBoundingClientRect().top < 80) top.scrollIntoView({ block: "start" });
    });
  };

  const pagedTier: DiscountTier = view.tier ?? "rest";
  const pagedItems = useMemo(() => {
    const seen = new Set<string>();
    return [...data[pagedTier].items, ...more.items].filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  }, [data, pagedTier, more.items]);
  const hasMore = pagedItems.length < data[pagedTier].count;

  const loadMore = async () => {
    if (moreLoading) return;
    const forQuery = query;
    const nextPage = more.page + 1;
    setMoreLoading(true);
    try {
      const res = await fetch(
        `/api/discounts${discountViewToQuery(view, { more: pagedTier, page: String(nextPage) })}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(String(res.status));
      const next: DiscountsResult = await res.json();
      if (queryRef.current !== forQuery) return;
      setMore((m) => ({ items: [...m.items, ...next[pagedTier].items], page: nextPage }));
    } catch {
      setError("More discounts didn't load. Try again.");
    } finally {
      setMoreLoading(false);
    }
  };


  const filtersActive = Boolean(
    view.filters.search.trim() || view.filters.bank || view.filters.category || view.filters.area,
  );
  const total = data.half.count + data.forty.count + data.rest.count;

  const menus = [
    ...(data.tab === "all"
      ? [
          {
            key: "bank" as const,
            title: "Bank",
            anyLabel: "All banks",
            menu: data.menus.bank,
            label: (v: string) => bankLookup.get(Number(v))?.name ?? "Bank",
            align: "start" as const,
          },
        ]
      : []),
    {
      key: "category" as const,
      title: "Category",
      anyLabel: "All categories",
      menu: data.menus.category,
      label: (v: string) => DISCOUNT_CATEGORIES.find((c) => c.value === v)?.label ?? v,
      align: "start" as const,
    },
    {
      key: "area" as const,
      title: "Area",
      anyLabel: "All areas",
      menu: data.menus.area,
      label: (v: string) => v,
      align: "end" as const,
    },
  ];

  const forYou = data.tab === "for-you";
  const busy = cn("transition-opacity duration-fast", loading && "opacity-60");

  const showMore = hasMore && (
    <button type="button" onClick={loadMore} disabled={moreLoading} className={cn(PILL_BUTTON, "mt-6 lg:mx-auto lg:mt-9 lg:w-[280px]")}>
      {moreLoading ? "Loading…" : "Show more"}
    </button>
  );

  return (
    <>
      <DiscountsHeader
        tab={data.tab}
        card={data.card}
        signedIn={data.signedIn}
        cards={data.cards}
        allCardsCount={data.allCardsCount}
        stats={data.stats}
        search={search}
        onSearch={setSearch}
        onShowAll={showAll}
        onPickCard={showForYou}
        onAddCard={() => setCardsMode("add")}
        onEditCards={() => setCardsMode("manage")}
        banks={bankLookup}
        bankList={banks}
        loginHref={loginHref}
        addCardHref={addCardHref}
        filters={menus.map((m) => (
          <FilterMenu
            key={m.key}
            title={m.title}
            anyLabel={m.anyLabel}
            anyCount={m.menu.anyCount}
            value={view.filters[m.key]}
            options={menuOptions(m.menu, view.filters[m.key], m.label)}
            onChange={(value) => setFilters({ [m.key]: value } as Partial<DiscountFilters>)}
            align={m.align}
          />
        ))}
      >
        {filtersActive && (
          <div className="mt-2.5 flex items-center gap-3 text-data lg:mt-3.5 lg:text-small" aria-live="polite">
            <span className="font-semibold">
              {fmt(total)} {total === 1 ? "discount" : "discounts"}
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 font-semibold text-muted-foreground underline underline-offset-[3px] transition-colors duration-fast hover:text-foreground"
            >
              Clear filters
            </button>
          </div>
        )}
        {error && (
          <p className="mt-3 text-data text-destructive" role="alert">
            {error}{" "}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setReload((r) => r + 1);
              }}
              className="font-semibold underline underline-offset-[3px]"
            >
              Try again
            </button>
          </p>
        )}
      </DiscountsHeader>

      <div ref={listTop} className="scroll-mt-24" aria-hidden="true" />

      {total === 0 ? (
        <Container className={cn(DISCOUNTS_WRAP, busy, "py-16 text-center lg:py-24")}>
          <p className="text-body font-bold">
            {filtersActive
              ? "No discounts match these filters"
              : forYou
                ? "Your cards don't unlock any offers yet"
                : "No discounts right now"}
          </p>
          {(filtersActive || forYou) && (
            <button
              type="button"
              onClick={filtersActive ? clearFilters : showAll}
              className="mt-4 h-11 rounded-full bg-primary px-6 text-body font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90"
            >
              {filtersActive ? "Clear filters" : "See all discounts"}
            </button>
          )}
        </Container>
      ) : view.tier ? (
        <Container className={cn(DISCOUNTS_WRAP, busy, "pb-12 pt-4 lg:pb-16 lg:pt-6")}>
          <section aria-labelledby="discounts-tier" aria-busy={loading}>
            <button
              type="button"
              onClick={() => openTier(null)}
              className="-ml-2 mb-2 flex h-11 items-center gap-1 rounded-control px-2 text-small font-semibold outline-none transition-colors duration-fast hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <SectionHead id="discounts-tier" title={TIER_TITLES[view.tier]} count={data[view.tier].count} />
            {view.tier === "rest" ? (
              <ul className="grid gap-3 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 xl:grid-cols-3">
                {pagedItems.map((item) => (
                  <li key={item.key} className="min-w-0">
                    <DealRow item={item} banks={bankLookup} onOpen={setOpenItem} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-6 lg:grid-cols-3 lg:gap-x-5 lg:gap-y-8 xl:grid-cols-4">
                {pagedItems.map((item) => (
                  <li key={item.key} className="min-w-0">
                    <DealCard
                      item={item}
                      banks={bankLookup}
                      onOpen={setOpenItem}
                      sizes="(min-width: 1280px) 270px, (min-width: 1024px) 30vw, 50vw"
                      photoClassName="h-[110px] lg:h-[168px]"
                      nameClassName="text-[15px] leading-5 lg:text-body lg:leading-[22px]"
                      className="w-full"
                    />
                  </li>
                ))}
              </ul>
            )}
            {showMore}
          </section>
        </Container>
      ) : (
        <>
          {data.half.items.length > 0 && (
            <Section
              tone="ink"
              size="sm"
              aria-labelledby="discounts-half"
              aria-busy={loading}
              className={cn(busy, "mt-6 pb-7 pt-6 md:pb-7 md:pt-6 lg:mt-8 lg:pb-10 lg:pt-8")}
            >
              <Container className={DISCOUNTS_WRAP}>
                <SectionHead
                  id="discounts-half"
                  title="Half off or more"
                  count={data.half.count}
                  onSeeAll={data.half.count > 4 ? () => openTier("half") : undefined}
                />
                {/* Phones swipe the row; desktop shows the first three or four. */}
                <ul className="scrollbar-hide -mx-5 -my-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 py-1 lg:mx-0 lg:my-0 lg:grid lg:grid-cols-3 lg:gap-x-5 lg:gap-y-7 lg:overflow-visible lg:px-0 lg:py-0 xl:grid-cols-4">
                  {data.half.items.map((item, i) => (
                    <li
                      key={item.key}
                      className={cn("w-[240px] shrink-0 snap-start lg:w-auto", i >= 3 && "lg:max-xl:hidden", i >= 4 && "lg:hidden")}
                    >
                      <DealCard
                        item={item}
                        banks={bankLookup}
                        onOpen={setOpenItem}
                        sizes="(min-width: 1280px) 270px, (min-width: 1024px) 30vw, 240px"
                        placeholder="bg-cream/10"
                        photoClassName="h-[132px] lg:h-[168px]"
                        className="w-full"
                      />
                    </li>
                  ))}
                </ul>
              </Container>
            </Section>
          )}

          <Container className={cn(DISCOUNTS_WRAP, "pb-12 lg:pb-16")}>
            {data.forty.items.length > 0 && (
              <section aria-labelledby="discounts-forty" aria-busy={loading} className={cn(busy, "pt-7 lg:pt-10")}>
                <SectionHead
                  id="discounts-forty"
                  title="40% off"
                  count={data.forty.count}
                  onSeeAll={data.forty.count > 4 ? () => openTier("forty") : undefined}
                />
                <ul className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-6 xl:grid-cols-6">
                  {data.forty.items.slice(0, 6).map((item, i) => (
                    <li key={item.key} className={cn("min-w-0", i >= 4 && "max-xl:hidden")}>
                      <DealCard
                        item={item}
                        banks={bankLookup}
                        onOpen={setOpenItem}
                        sizes="(min-width: 1280px) 180px, (min-width: 1024px) 25vw, 50vw"
                        photoClassName="h-[100px] lg:h-[112px]"
                        nameClassName="text-[15px] leading-5 lg:text-body lg:leading-[22px]"
                        className="w-full"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.rest.count > 0 && (
              <section aria-labelledby="discounts-rest" aria-busy={loading} className={cn(busy, "pt-8 lg:pt-11")}>
                <SectionHead
                  id="discounts-rest"
                  title={forYou ? "More for your cards" : "More discounts"}
                  count={data.rest.count}
                />
                <ul className="grid gap-3 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 xl:grid-cols-3">
                  {pagedItems.map((item) => (
                    <li key={item.key} className="min-w-0">
                      <DealRow item={item} banks={bankLookup} onOpen={setOpenItem} />
                    </li>
                  ))}
                </ul>
                {showMore}
              </section>
            )}
          </Container>
        </>
      )}

      <DealSheet
        item={openItem}
        detailHref={openItem ? `/api/discounts${discountViewToQuery(view, { detail: openItem.key })}` : null}
        banks={bankLookup}
        onClose={() => setOpenItem(null)}
      />
      <CardsDialog
        mode={cardsMode}
        onModeChange={setCardsMode}
        cards={data.cards}
        banks={banks}
        onChanged={(added) => {
          if (added != null) showForYou(null);
          setReload((r) => r + 1);
        }}
      />
    </>
  );
}
