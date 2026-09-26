"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Compass,
  Home as HomeIcon,
  Layers,
  Loader2,
  MapPin,
  Percent,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PAGE_SECTIONS_CONFIG,
  type PageSectionsConfig,
} from "@/lib/page-sections/types";

type SlideKind = "event" | "listing";
type SlideRef = { kind: SlideKind; id: number };

type Preview = {
  kind: SlideKind;
  id: number;
  title: string;
  image_url: string | null;
  subtitle: string | null;
  status: string | null;
  valid: boolean;
  warning: string | null;
};

type SearchHit = {
  kind: SlideKind;
  id: number;
  title: string;
  subtitle: string | null;
  status: string | null;
  is_featured: boolean;
};

type HeroPayload = {
  config: { slides: SlideRef[]; fill_remaining: boolean };
  resolved: Preview[];
  max_slides: number;
};

type SectionItem<K extends string = string> = {
  key: K;
  label: string;
  description: string;
  note?: string;
};

const HOME_SECTIONS: SectionItem<keyof PageSectionsConfig["home"]>[] = [
  { key: "opener", label: "This week opener", description: "Hero carousel at the top of Home" },
  { key: "categories", label: "Explore Categories", description: "Pills linking directly to core categories" },
  { key: "spine", label: "What's on", description: "Chronological event timeline" },
  { key: "ending", label: "Ending soon", description: "Card discounts & offers expiring soon" },
  {
    key: "budget",
    label: "Free & under PKR 1,000",
    description: "Budget-friendly activities",
    note: "Also requires the ticket sales feature flag to be active",
  },
  { key: "foryou", label: "For you", description: "Personalized event and place recommendations" },
  { key: "opennow", label: "Open now", description: "Places open right now near the user" },
  { key: "detour", label: "Worth the detour", description: "Curated destinations and hidden gems" },
  { key: "feature", label: "This week in Karachi", description: "Weekly editorial feature spotlight" },
  { key: "stat", label: "Your Karachi", description: "Personalized user exploration stats counter" },
  { key: "wallet", label: "Your card discounts", description: "Discounts unlocked by user's bank cards" },
  { key: "neighbourhood", label: "Where to", description: "Neighborhood exploration carousel" },
];

const EXPLORE_SECTIONS: SectionItem<keyof PageSectionsConfig["explore"]>[] = [
  { key: "browse", label: "Browse all", description: "All-categories discover grid" },
  { key: "top", label: "Top places near you", description: "Highest rated places nearby" },
  { key: "featured", label: "Worth knowing about", description: "Curated featured places rail" },
  { key: "justadded", label: "Just added", description: "Recently listed venues & places" },
];

const EVENTS_SECTIONS: SectionItem<keyof PageSectionsConfig["events"]>[] = [
  { key: "featured", label: "Featured", description: "Handpicked events carousel at the top" },
  { key: "browse_type", label: "Browse by type", description: "Events grouped by category" },
  { key: "venues", label: "Venues to watch", description: "Popular event venues rail" },
  { key: "organisers", label: "Organisers to follow", description: "Top event organisers rail" },
];

const DEALS_SECTIONS: SectionItem<keyof PageSectionsConfig["deals"]>[] = [
  { key: "spotlight", label: "Spotlight deal", description: "Top featured hero offer in the bento header" },
  { key: "my_cards", label: "Deals on your cards", description: "Offers matching the user's saved bank cards" },
  { key: "trending", label: "Trending deals", description: "Most popular discounts across Karachi" },
  { key: "banks", label: "Browse by bank", description: "Bank chip list to filter deals" },
];

export function AppLayoutPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"hero" | "home" | "explore" | "events" | "deals">("hero");

  // Hero state
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroSaving, setHeroSaving] = useState(false);
  const [slides, setSlides] = useState<SlideRef[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [fillRemaining, setFillRemaining] = useState(true);
  const [maxSlides, setMaxSlides] = useState(4);
  const [searchKind, setSearchKind] = useState<SlideKind>("event");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);

  // Sections state
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionsSaving, setSectionsSaving] = useState(false);
  const [sectionsConfig, setSectionsConfig] = useState<PageSectionsConfig>(
    JSON.parse(JSON.stringify(DEFAULT_PAGE_SECTIONS_CONFIG)),
  );

  const applyHeroPayload = useCallback((data: HeroPayload) => {
    setSlides(data.config.slides);
    setFillRemaining(data.config.fill_remaining);
    setPreviews(data.resolved);
    setMaxSlides(data.max_slides);
  }, []);

  const loadHero = useCallback(async () => {
    setHeroLoading(true);
    try {
      const res = await fetch("/api/admin/home-opener");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load hero");
      applyHeroPayload(json.data as HeroPayload);
    } catch (error) {
      toast({
        title: "Couldn’t load hero config",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setHeroLoading(false);
    }
  }, [applyHeroPayload, toast]);

  const loadSections = useCallback(async () => {
    setSectionsLoading(true);
    try {
      const res = await fetch("/api/admin/page-sections");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load sections");
      if (json.data) {
        setSectionsConfig(json.data as PageSectionsConfig);
      }
    } catch (error) {
      toast({
        title: "Couldn’t load section toggles",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSectionsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadHero();
    loadSections();
  }, [loadHero, loadSections]);

  const previewByKey = useMemo(() => {
    const map = new Map<string, Preview>();
    for (const p of previews) map.set(`${p.kind}:${p.id}`, p);
    return map;
  }, [previews]);

  const runSearch = useCallback(async () => {
    setSearching(true);
    try {
      const params = new URLSearchParams({ kind: searchKind });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/home-opener/search?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      setHits((json.data as SearchHit[]) ?? []);
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  }, [query, searchKind, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      void runSearch();
    }, 250);
    return () => clearTimeout(t);
  }, [runSearch]);

  const addSlide = (hit: SearchHit) => {
    if (slides.length >= maxSlides) {
      toast({
        title: "Hero is full",
        description: `You can pin at most ${maxSlides} slides.`,
        variant: "destructive",
      });
      return;
    }
    if (slides.some((s) => s.kind === hit.kind && s.id === hit.id)) {
      toast({ title: "Already pinned", description: hit.title });
      return;
    }
    setSlides((prev) => [...prev, { kind: hit.kind, id: hit.id }]);
    setPreviews((prev) => [
      ...prev,
      {
        kind: hit.kind,
        id: hit.id,
        title: hit.title,
        image_url: null,
        subtitle: hit.subtitle,
        status: hit.status,
        valid: true,
        warning: null,
      },
    ]);
  };

  const removeAt = (index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
    setPreviews((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  const saveHero = async () => {
    setHeroSaving(true);
    try {
      const res = await fetch("/api/admin/home-opener", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides,
          fill_remaining: fillRemaining,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      applyHeroPayload(json.data as HeroPayload);
      toast({
        title: "Home hero saved",
        description:
          slides.length === 0
            ? "Empty — the app will use the automatic featured + trending picks."
            : `${slides.length} curated slide${slides.length === 1 ? "" : "s"} live on the app.`,
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setHeroSaving(false);
    }
  };

  const updateSectionToggle = <P extends keyof PageSectionsConfig>(
    page: P,
    key: keyof PageSectionsConfig[P],
    value: boolean,
  ) => {
    setSectionsConfig((prev) => ({
      ...prev,
      [page]: {
        ...prev[page],
        [key]: value,
      },
    }));
  };

  const saveSections = async () => {
    setSectionsSaving(true);
    try {
      const res = await fetch("/api/admin/page-sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sectionsConfig),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save sections");
      if (json.data) {
        setSectionsConfig(json.data as PageSectionsConfig);
      }
      toast({
        title: "Section toggles saved",
        description: "Mobile feed section visibility has been updated.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSectionsSaving(false);
    }
  };

  const isLoading = heroLoading || sectionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading app layout…
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">App Layout</h1>
          </div>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Curate hero slides and choose which feed sections appear in the mobile app.
          </p>
        </div>

        <div>
          {activeTab === "hero" ? (
            <Button onClick={saveHero} disabled={heroSaving} className="gap-2">
              {heroSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save hero
            </Button>
          ) : (
            <Button onClick={saveSections} disabled={sectionsSaving} className="gap-2">
              {sectionsSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save sections
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          setActiveTab(val as "hero" | "home" | "explore" | "events" | "deals")
        }
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="hero" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Hero
          </TabsTrigger>
          <TabsTrigger value="home" className="gap-1.5">
            <HomeIcon className="h-4 w-4" />
            Home
          </TabsTrigger>
          <TabsTrigger value="explore" className="gap-1.5">
            <Compass className="h-4 w-4" />
            Explore
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5">
            <Percent className="h-4 w-4" />
            Deals
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Hero ── */}
        <TabsContent value="hero" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Pinned slides ({slides.length}/{maxSlides})
              </CardTitle>
              <CardDescription>
                Pin up to {maxSlides} events or places in display order. Leave empty to use the automatic featured-event + trending places algorithm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <Label htmlFor="fill-remaining" className="text-sm font-medium">
                    Fill remaining slots automatically
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    After your pins, top up to {maxSlides} with the featured event /
                    trending places algorithm.
                  </p>
                </div>
                <Switch
                  id="fill-remaining"
                  checked={fillRemaining}
                  onCheckedChange={setFillRemaining}
                />
              </div>

              {slides.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No curated slides. The app will fall back to the automatic hero.
                </div>
              ) : (
                <ul className="space-y-3">
                  {slides.map((slide, index) => {
                    const preview =
                      previewByKey.get(`${slide.kind}:${slide.id}`) ??
                      previews[index];
                    return (
                      <li
                        key={`${slide.kind}-${slide.id}`}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3",
                          preview && !preview.valid && "border-amber-500/50 bg-amber-500/5",
                        )}
                      >
                        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                          {preview?.image_url ? (
                            <Image
                              src={preview.image_url}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              {slide.kind === "event" ? (
                                <Calendar className="h-5 w-5" />
                              ) : (
                                <MapPin className="h-5 w-5" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {index + 1}. {slide.kind}
                            </Badge>
                            {preview?.warning ? (
                              <Badge variant="outline" className="text-amber-700">
                                {preview.warning}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate font-medium">
                            {preview?.title ?? `#${slide.id}`}
                          </p>
                          {preview?.subtitle ? (
                            <p className="truncate text-sm text-muted-foreground">
                              {preview.subtitle}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => move(index, 1)}
                            disabled={index === slides.length - 1}
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeAt(index)}
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />
                Add a slide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={searchKind}
                onValueChange={(v) => setSearchKind(v as SlideKind)}
              >
                <TabsList>
                  <TabsTrigger value="event">Events</TabsTrigger>
                  <TabsTrigger value="listing">Places</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={
                    searchKind === "event"
                      ? "Search live events…"
                      : "Search published places…"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {searching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : hits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {hits.map((hit) => {
                    const pinned = slides.some(
                      (s) => s.kind === hit.kind && s.id === hit.id,
                    );
                    return (
                      <li
                        key={`${hit.kind}-${hit.id}`}
                        className="flex items-center gap-3 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{hit.title}</p>
                            {hit.is_featured ? (
                              <Badge variant="secondary">Featured</Badge>
                            ) : null}
                          </div>
                          {hit.subtitle ? (
                            <p className="truncate text-sm text-muted-foreground">
                              {hit.subtitle}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={pinned ? "outline" : "default"}
                          disabled={pinned || slides.length >= maxSlides}
                          onClick={() => addSlide(hit)}
                        >
                          {pinned ? "Pinned" : "Add"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Home ── */}
        <TabsContent value="home" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Home Feed Sections</CardTitle>
                  <CardDescription>
                    Toggle which sections appear in the mobile Home feed. Core search header and ad slots are always visible.
                  </CardDescription>
                </div>
                <Button onClick={saveSections} disabled={sectionsSaving} size="sm" className="gap-2">
                  {sectionsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Home
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {HOME_SECTIONS.map((sec) => {
                  const enabled = sectionsConfig.home[sec.key];
                  return (
                    <div
                      key={sec.key}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`home-${sec.key}`} className="text-sm font-medium cursor-pointer">
                            {sec.label}
                          </Label>
                          <Badge variant={enabled ? "default" : "outline"} className="text-xs">
                            {enabled ? "Visible" : "Hidden"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sec.description}</p>
                        {sec.note ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400">{sec.note}</p>
                        ) : null}
                      </div>
                      <Switch
                        id={`home-${sec.key}`}
                        checked={enabled}
                        onCheckedChange={(val) => updateSectionToggle("home", sec.key, val)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Explore ── */}
        <TabsContent value="explore" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Explore Feed Sections</CardTitle>
                  <CardDescription>
                    Toggle browse rails and shelves in the Explore tab. The search bar and recent searches remain always active.
                  </CardDescription>
                </div>
                <Button onClick={saveSections} disabled={sectionsSaving} size="sm" className="gap-2">
                  {sectionsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Explore
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {EXPLORE_SECTIONS.map((sec) => {
                  const enabled = sectionsConfig.explore[sec.key];
                  return (
                    <div
                      key={sec.key}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`explore-${sec.key}`} className="text-sm font-medium cursor-pointer">
                            {sec.label}
                          </Label>
                          <Badge variant={enabled ? "default" : "outline"} className="text-xs">
                            {enabled ? "Visible" : "Hidden"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sec.description}</p>
                      </div>
                      <Switch
                        id={`explore-${sec.key}`}
                        checked={enabled}
                        onCheckedChange={(val) => updateSectionToggle("explore", sec.key, val)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Events ── */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Events Feed Sections</CardTitle>
                  <CardDescription>
                    Toggle featured and discovery sections in the Events tab. The main upcoming event list always remains visible.
                  </CardDescription>
                </div>
                <Button onClick={saveSections} disabled={sectionsSaving} size="sm" className="gap-2">
                  {sectionsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Events
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {EVENTS_SECTIONS.map((sec) => {
                  const enabled = sectionsConfig.events[sec.key];
                  return (
                    <div
                      key={sec.key}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`events-${sec.key}`} className="text-sm font-medium cursor-pointer">
                            {sec.label}
                          </Label>
                          <Badge variant={enabled ? "default" : "outline"} className="text-xs">
                            {enabled ? "Visible" : "Hidden"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sec.description}</p>
                      </div>
                      <Switch
                        id={`events-${sec.key}`}
                        checked={enabled}
                        onCheckedChange={(val) => updateSectionToggle("events", sec.key, val)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Deals ── */}
        <TabsContent value="deals" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Deals Feed Sections</CardTitle>
                  <CardDescription>
                    Toggle spotlight, bank and personalized carousels. The main all-discounts catalog and category chips stay permanently available.
                  </CardDescription>
                </div>
                <Button onClick={saveSections} disabled={sectionsSaving} size="sm" className="gap-2">
                  {sectionsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Deals
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {DEALS_SECTIONS.map((sec) => {
                  const enabled = sectionsConfig.deals[sec.key];
                  return (
                    <div
                      key={sec.key}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`deals-${sec.key}`} className="text-sm font-medium cursor-pointer">
                            {sec.label}
                          </Label>
                          <Badge variant={enabled ? "default" : "outline"} className="text-xs">
                            {enabled ? "Visible" : "Hidden"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sec.description}</p>
                      </div>
                      <Switch
                        id={`deals-${sec.key}`}
                        checked={enabled}
                        onCheckedChange={(val) => updateSectionToggle("deals", sec.key, val)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Retain HomeHeroPage alias for backward compatibility
export { AppLayoutPage as HomeHeroPage };
