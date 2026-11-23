"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Container, Section } from "@/components/ds";
import { FilterMenu, type FilterMenuOption } from "@/components/events/list/FilterMenu";
import { SectionHeader } from "@/components/landing/SectionHeader";
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
const places = (n: number) => `${fmt(n)} ${n === 1 ? "place" : "places"}`;

const TIER_TITLES: Record<DiscountTier, string> = {
  half: "Half off or more",
  forty: "40% off",
  rest: "More discounts",
};

const PILL_BUTTON =
  "flex h-11 w-full items-center justify-center rounded-full bg-muted text-small font-semibold outline-none transition-colors duration-fast hover:bg-border focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";

const PINK_BUTTON =
  "flex h-12 w-full items-center justify-center rounded-full bg-primary px-4 text-[15px] font-semibold text-primary-foreground outline-none transition-opacity duration-fast hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:h-[52px] lg:text-body";

/** Menu options, keeping a picked value visible even when nothing matches it any more. */
function menuOptions(menu: DiscountMenu, value: string | null, label: (v: string) => string): FilterMenuOption[] {
  if (!value || menu.options.some((o) => o.value === value)) return menu.options;
  return [...menu.options, { value, label: label(value), count: 0 }];
}

/**
 * /discounts (round 9 Y): the /events top on white with the reader's cards as
 * homepage bank-picker tiles, then homepage-style sections: half off on a
 * black band, 40% off and everything else on white. Each section opens with
 * the homepage's SectionHeader. "All N" opens one section as a grid.
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
  const [halfLead, ...halfMore] = data.half.items;
  const [fortyLead, ...fortyMore] = data.forty.items;

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
        <Container className={cn(DISCOUNTS_WRAP, busy, "pb-16 pt-4 lg:pb-24 lg:pt-6")}>
          <section aria-labelledby="discounts-tier" aria-busy={loading}>
            <button
              type="button"
              onClick={() => openTier(null)}
              className="-ml-2 mb-2 flex h-11 items-center gap-1 rounded-control px-2 text-small font-semibold outline-none transition-colors duration-fast hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <SectionHeader
              id="discounts-tier"
              eyebrow={forYou ? "Your cards" : "All discounts"}
              title={TIER_TITLES[view.tier]}
              subline={places(data[view.tier].count)}
            />
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
                      sizes="(min-width: 1280px) 280px, (min-width: 1024px) 30vw, 50vw"
                      nameClassName="text-[15px] leading-5 lg:text-[17px] lg:leading-6"
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
          {halfLead && (
            <Section tone="ink" size="md" aria-labelledby="discounts-half" aria-busy={loading} className={busy}>
              <Container className={DISCOUNTS_WRAP}>
                <SectionHeader
                  id="discounts-half"
                  eyebrow="Half off or more"
                  title={forYou ? "Your biggest discounts" : "The biggest discounts"}
                  action={data.half.count > 3 ? { label: `All ${fmt(data.half.count)}`, onClick: () => openTier("half") } : undefined}
                />
                <div className="flex flex-col gap-7 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
                  <DealCard
                    item={halfLead}
                    banks={bankLookup}
                    onOpen={setOpenItem}
                    sizes="(min-width: 1024px) 568px, 100vw"
                    placeholder="bg-cream/10"
                    nameClassName="mt-0.5 text-[22px] leading-7 tracking-[-0.025em] lg:text-[32px] lg:leading-10"
                  />
                  {halfMore.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-6 lg:gap-x-5">
                      {halfMore.slice(0, 4).map((item, i) => (
                        <DealCard
                          key={item.key}
                          item={item}
                          banks={bankLookup}
                          onOpen={setOpenItem}
                          sizes="(min-width: 1024px) 274px, 50vw"
                          placeholder="bg-cream/10"
                          nameClassName="text-[15px] leading-5 lg:text-[17px] lg:leading-6"
                          className={cn(i >= 2 && "max-lg:hidden")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Container>
            </Section>
          )}

          {fortyLead && (
            <Section size="md" aria-labelledby="discounts-forty" aria-busy={loading} className={busy}>
              <Container className={DISCOUNTS_WRAP}>
                <SectionHeader
                  id="discounts-forty"
                  eyebrow="40% off"
                  title={forYou ? "40% off with your cards" : "40% off, all over town"}
                  subline={`${places(data.forty.count)}. Each bank sets its own terms.`}
                  action={data.forty.count > 4 ? { label: `All ${fmt(data.forty.count)}`, onClick: () => openTier("forty") } : undefined}
                />
                {/* Phones: one big card, then rows. Desktop: two rows of three. */}
                <div className="lg:hidden">
                  <DealCard item={fortyLead} banks={bankLookup} onOpen={setOpenItem} sizes="100vw" className="w-full" />
                  {fortyMore.length > 0 && (
                    <ul className="mt-5 grid gap-3">
                      {fortyMore.slice(0, 3).map((item) => (
                        <li key={item.key} className="min-w-0">
                          <DealRow item={item} banks={bankLookup} onOpen={setOpenItem} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <ul className="hidden grid-cols-3 gap-x-5 gap-y-8 lg:grid">
                  {data.forty.items.slice(0, 6).map((item) => (
                    <li key={item.key} className="min-w-0">
                      <DealCard item={item} banks={bankLookup} onOpen={setOpenItem} sizes="380px" className="w-full" />
                    </li>
                  ))}
                </ul>
                {data.forty.count > 4 && (
                  <button
                    type="button"
                    onClick={() => openTier("forty")}
                    className={cn(PINK_BUTTON, "mt-6 lg:mx-auto lg:mt-9 lg:w-[320px]", data.forty.count <= 6 && "lg:hidden")}
                  >
                    See all {fmt(data.forty.count)} at 40% off
                  </button>
                )}
              </Container>
            </Section>
          )}

          {data.rest.count > 0 && (
            <Section
              size="md"
              aria-labelledby="discounts-rest"
              aria-busy={loading}
              className={cn(busy, fortyLead && "pt-0 md:pt-0")}
            >
              <Container className={DISCOUNTS_WRAP}>
                <div className={cn(fortyLead && "border-t border-border pt-16 md:pt-24")}>
                  <SectionHeader
                    id="discounts-rest"
                    eyebrow={forYou ? "More for your cards" : "More discounts"}
                    title={halfLead || fortyLead ? `${fmt(data.rest.count)} more ${data.rest.count === 1 ? "place" : "places"}` : places(data.rest.count)}
                  />
                  <ul className="grid gap-3 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 xl:grid-cols-3">
                    {pagedItems.map((item) => (
                      <li key={item.key} className="min-w-0">
                        <DealRow item={item} banks={bankLookup} onOpen={setOpenItem} />
                      </li>
                    ))}
                  </ul>
                  {showMore}
                </div>
              </Container>
            </Section>
          )}
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
