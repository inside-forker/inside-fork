"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

type Payload = {
  config: { slides: SlideRef[]; fill_remaining: boolean };
  resolved: Preview[];
  max_slides: number;
};

export function HomeHeroPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slides, setSlides] = useState<SlideRef[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [fillRemaining, setFillRemaining] = useState(true);
  const [maxSlides, setMaxSlides] = useState(4);

  const [searchKind, setSearchKind] = useState<SlideKind>("event");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);

  const applyPayload = useCallback((data: Payload) => {
    setSlides(data.config.slides);
    setFillRemaining(data.config.fill_remaining);
    setPreviews(data.resolved);
    setMaxSlides(data.max_slides);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/home-opener");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      applyPayload(json.data as Payload);
    } catch (error) {
      toast({
        title: "Couldn’t load hero config",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [applyPayload, toast]);

  useEffect(() => {
    load();
  }, [load]);

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

  const save = async () => {
    setSaving(true);
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
      applyPayload(json.data as Payload);
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
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading home hero…
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Home hero</h1>
          <p className="max-w-2xl text-muted-foreground">
            Control the swipeable opener at the top of the mobile Home tab.
            Pin up to {maxSlides} events or places in order. Leave empty to use
            the automatic featured-event + trending listings algorithm.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save hero
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Pinned slides ({slides.length}/{maxSlides})
          </CardTitle>
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
    </div>
  );
}
