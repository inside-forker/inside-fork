"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  type DiscountTab,
  type DiscountTier,
  type DiscountView,
  type DiscountsResult,
} from "@/lib/discounts/types";
import { CreamDealCard, DealRow, InkDealCard, type BankLookup } from "@/components/discounts/DealCards";
import { DealSheet } from "@/components/discounts/DealSheet";
import { CardsDialog, type CardsDialogMode } from "@/components/discounts/CardsDialog";
import { DiscountsHeader } from "@/components/discounts/DiscountsHeader";

const fmt = (n: number) => n.toLocaleString("en-US");

const TIER_TITLES: Record<DiscountTier, string> = {
  half: "Half off or more",
  forty: "40% off",
  rest: "More discounts",
};

/** A horizontal row with prev/next buttons that page it by its own width. */
function useScrollRow(itemsKey: string) {
  // A callback ref, so the row is re-measured whenever its element remounts.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });

  useEffect(() => {
    if (!el) return;
    const measure = () =>
      setEdges({
        prev: el.scrollLeft > 4,
        next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    el.scrollLeft = 0;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [el, itemsKey]);

  const go = (dir: 1 | -1) => {
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  return { ref: setEl, edges, go };
}

function RowArrows({
  row,
  label,
  tone,
}: {
  row: ReturnType<typeof useScrollRow>;
  label: string;
  tone: "ink" | "cream";
}) {
  if (!row.edges.prev && !row.edges.next) return null;
  const btn = cn(
    "flex h-9 w-9 items-center justify-center rounded-full text-foreground outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40",
    tone === "ink"
      ? "bg-cream/10 hover:bg-cream/20 disabled:hover:bg-cream/10"
      : "bg-white hover:bg-white/70 disabled:hover:bg-white",
  );
  return (
    <div className="hidden items-center gap-2 lg:flex">
      <button type="button" aria-label={`Previous ${label}`} disabled={!row.edges.prev} onClick={() => row.go(-1)} className={btn}>
        <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
      </button>
      <button type="button" aria-label={`Next ${label}`} disabled={!row.edges.next} onClick={() => row.go(1)} className={btn}>
        <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}

function SectionHead({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3 lg:mb-3.5">
      <h2 id={id} className="text-[15px] font-bold leading-5 tracking-[-0.01em] lg:text-[17px] lg:leading-6">
        {title}
        <span className="ml-1.5 text-data font-semibold tracking-normal text-muted-foreground lg:text-small">
          {fmt(count)}
        </span>
      </h2>
      {children}
    </div>
  );
}

function SeeAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-8 text-data font-semibold underline underline-offset-[3px] outline-none before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-primary lg:mr-2 lg:text-small"
    >
      See all
    </button>
  );
}

const PILL_BUTTON =
  "flex h-11 w-full items-center justify-center rounded-full bg-muted text-small font-semibold outline-none transition-colors duration-fast hover:bg-border focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";

/** Menu options, keeping a picked value visible even when nothing matches it any more. */
function menuOptions(menu: DiscountMenu, value: string | null, label: (v: string) => string): FilterMenuOption[] {
  if (!value || menu.options.some((o) => o.value === value)) return menu.options;
  return [...menu.options, { value, label: label(value), count: 0 }];
}

/**
 * /discounts in three colour bands (W1): one black band holds the card-wallet
 * header, the filter menus and the half-off row; 40% off sits on a cream
 * band; everything else is white rows. "See all" opens one section as a grid
 * of black or cream cards on white.
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
  const router = useRouter();
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

  const hasCards = data.cards.length > 0;
  const setFilters = (patch: Partial<DiscountFilters>) =>
    setView((v) => ({ ...v, filters: { ...v.filters, ...patch } }));
  const clearFilters = () => {
    setSearch("");
    setView((v) => ({ ...v, filters: NO_DISCOUNT_FILTERS }));
  };

  const showForYou = (card: number | null) =>
    setView((v) => ({ ...v, tab: "for-you", card, tier: null, filters: { ...v.filters, bank: null } }));

  const onTab = (tab: DiscountTab) => {
    if (tab === "all") {
      setView((v) => ({ ...v, tab: "all", card: null, tier: null }));
      return;
    }
    if (hasCards) showForYou(null);
    else if (data.signedIn) setCardsMode("add");
    else router.push(addCardHref);
  };

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

  const halfRow = useScrollRow(data.half.items.map((i) => i.key).join("|"));
  const fortyRow = useScrollRow(data.forty.items.map((i) => i.key).join("|"));

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

  // The three-section view (vs one section's grid or an empty state).
  const sectioned = total > 0 && !view.tier;
  const busy = cn("transition-opacity duration-fast", loading && "opacity-60");

  const showMore = hasMore && (
    <button type="button" onClick={loadMore} disabled={moreLoading} className={cn(PILL_BUTTON, "mt-4 lg:mx-auto lg:mt-7 lg:w-[280px]")}>
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
        onTab={onTab}
        onPickCard={showForYou}
        onAddCard={() => setCardsMode("add")}
        onEditCards={() => setCardsMode("manage")}
        banks={bankLookup}
        bankList={banks}
        loginHref={loginHref}
        addCardHref={addCardHref}
      >
        <Container className="max-w-[1200px] px-5 sm:px-5 lg:px-8">
          <div ref={listTop} className="mt-5 scroll-mt-24 border-t border-border pt-4 lg:mt-8 lg:pt-6">
            <div role="group" aria-label="Filter discounts" className="flex flex-wrap items-center gap-2">
              {menus.map((m) => (
                <FilterMenu
                  key={m.key}
                  title={m.title}
                  anyLabel={m.anyLabel}
                  anyCount={m.menu.anyCount}
                  value={view.filters[m.key]}
                  options={menuOptions(m.menu, view.filters[m.key], m.label)}
                  onChange={(value) => setFilters({ [m.key]: value } as Partial<DiscountFilters>)}
                  align={m.align}
                  tone="dark"
                />
              ))}
            </div>

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
              <p className="mt-3 text-data font-semibold" role="alert">
                {error}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setReload((r) => r + 1);
                  }}
                  className="underline underline-offset-[3px]"
                >
                  Try again
                </button>
              </p>
            )}
          </div>

          {sectioned && data.half.count > 0 && (
            <section aria-labelledby="discounts-half" aria-busy={loading} className={cn("mt-6 lg:mt-10", busy)}>
              <SectionHead id="discounts-half" title="Half off or more" count={data.half.count}>
                <div className="flex items-center gap-2">
                  {data.half.count > data.half.items.length && <SeeAll onClick={() => openTier("half")} />}
                  <RowArrows row={halfRow} label="half-off discounts" tone="ink" />
                </div>
              </SectionHead>
              <div
                ref={halfRow.ref}
                className="scrollbar-hide -mx-5 -my-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 py-1 lg:mx-0 lg:gap-5 lg:scroll-px-0 lg:px-0"
              >
                {data.half.items.map((item) => (
                  <InkDealCard
                    key={item.key}
                    item={item}
                    banks={bankLookup}
                    onOpen={setOpenItem}
                    flat
                    className="w-[240px] shrink-0 snap-start lg:w-[calc((100%-40px)/3)] xl:w-[calc((100%-60px)/4)]"
                  />
                ))}
              </div>
            </section>
          )}
        </Container>
      </DiscountsHeader>

      {sectioned && data.forty.count > 0 && (
        <Section as="div" tone="cream" size="sm" className="py-6 md:py-6 lg:py-10">
          <Container className="max-w-[1200px] px-5 sm:px-5 lg:px-8">
            <section aria-labelledby="discounts-forty" aria-busy={loading} className={busy}>
              <SectionHead id="discounts-forty" title="40% off" count={data.forty.count}>
                <div className="hidden items-center gap-2 lg:flex">
                  {data.forty.count > data.forty.items.length && <SeeAll onClick={() => openTier("forty")} />}
                  <RowArrows row={fortyRow} label="40% off discounts" tone="cream" />
                </div>
              </SectionHead>
              <div
                ref={fortyRow.ref}
                className="scrollbar-hide grid grid-cols-2 gap-x-3 gap-y-4 lg:-my-1 lg:flex lg:snap-x lg:snap-mandatory lg:gap-5 lg:overflow-x-auto lg:py-1"
              >
                {data.forty.items.map((item, i) => (
                  <CreamDealCard
                    key={item.key}
                    item={item}
                    banks={bankLookup}
                    onOpen={setOpenItem}
                    flat
                    className={cn(
                      "lg:w-[calc((100%-60px)/4)] lg:shrink-0 lg:snap-start xl:w-[calc((100%-100px)/6)]",
                      i >= 4 && "max-lg:hidden",
                    )}
                  />
                ))}
              </div>
              {data.forty.count > 4 && (
                <button
                  type="button"
                  onClick={() => openTier("forty")}
                  className={cn(PILL_BUTTON, "mt-5 bg-white hover:bg-white/70 lg:hidden")}
                >
                  See all {fmt(data.forty.count)}
                </button>
              )}
            </section>
          </Container>
        </Section>
      )}

      <Container className="max-w-[1200px] px-5 pb-9 pt-6 sm:px-5 lg:px-8 lg:pb-16 lg:pt-10">
        <div aria-busy={loading} className={busy}>
          {total === 0 ? (
            <div className="py-16 text-center lg:py-24">
              <p className="text-body font-bold">
                {filtersActive
                  ? "No discounts match these filters"
                  : data.tab === "for-you"
                    ? "Your cards don't unlock any offers yet"
                    : "No discounts right now"}
              </p>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 h-11 rounded-full bg-primary px-6 text-body font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90"
                >
                  Clear filters
                </button>
              ) : data.tab === "for-you" ? (
                <button
                  type="button"
                  onClick={() => onTab("all")}
                  className="mt-4 h-11 rounded-full bg-primary px-6 text-body font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90"
                >
                  See all discounts
                </button>
              ) : null}
            </div>
          ) : view.tier ? (
            <section aria-labelledby="discounts-tier" className="-mt-2">
              <button
                type="button"
                onClick={() => openTier(null)}
                className="-ml-2 flex h-11 items-center gap-1 rounded-control px-2 text-small font-semibold outline-none transition-colors duration-fast hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>
              <SectionHead id="discounts-tier" title={TIER_TITLES[view.tier]} count={data[view.tier].count} />
              <ul
                className={cn(
                  view.tier === "half" && "grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4",
                  view.tier === "forty" && "grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4 xl:grid-cols-6",
                  view.tier === "rest" && "lg:grid lg:grid-cols-2 lg:gap-x-8 xl:grid-cols-3",
                )}
              >
                {pagedItems.map((item) => (
                  <li key={item.key} className="min-w-0">
                    {view.tier === "half" ? (
                      <InkDealCard item={item} banks={bankLookup} onOpen={setOpenItem} className="w-full" />
                    ) : view.tier === "forty" ? (
                      <CreamDealCard item={item} banks={bankLookup} onOpen={setOpenItem} className="w-full" />
                    ) : (
                      <DealRow item={item} banks={bankLookup} onOpen={setOpenItem} />
                    )}
                  </li>
                ))}
              </ul>
              {showMore}
            </section>
          ) : data.rest.count > 0 ? (
            <section aria-labelledby="discounts-rest">
              <SectionHead
                id="discounts-rest"
                title={data.tab === "for-you" ? "More for your cards" : "More discounts"}
                count={data.rest.count}
              />
              <ul className="lg:grid lg:grid-cols-2 lg:gap-x-8 xl:grid-cols-3">
                {pagedItems.map((item) => (
                  <li key={item.key} className="min-w-0">
                    <DealRow item={item} banks={bankLookup} onOpen={setOpenItem} />
                  </li>
                ))}
              </ul>
              {showMore}
            </section>
          ) : null}
        </div>
      </Container>

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
