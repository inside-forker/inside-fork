import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Container,
  Heading,
  Label,
  Reveal,
  RuledList,
  RuledListItem,
  Section,
} from "@/components/ds";

// Dev-only preview of the design-system kit (components/ds). It 404s in
// production builds; run `npm run dev` and open /design-preview.
export const metadata: Metadata = {
  title: "Design preview",
  robots: { index: false, follow: false },
};

const swatches = [
  { name: "primary", className: "bg-primary" },
  { name: "ink", className: "bg-ink" },
  { name: "cream", className: "bg-cream" },
  { name: "background", className: "bg-background" },
  { name: "muted", className: "bg-muted" },
  { name: "border", className: "bg-border" },
  { name: "destructive", className: "bg-destructive" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
];

const typeScale = [
  { token: "text-display-xl", className: "font-display text-display-xl", sample: "Karachi after dark" },
  { token: "text-display-lg", className: "font-display text-display-lg", sample: "Karachi after dark" },
  { token: "text-display-md", className: "font-display text-display-md", sample: "Karachi after dark" },
  { token: "text-title", className: "font-display text-title", sample: "Where to eat in Clifton" },
  { token: "text-body-lg", className: "font-ui text-body-lg", sample: "A short supporting sentence that sets up the page." },
  { token: "text-body", className: "font-ui text-body", sample: "Body copy in Instrument Sans, kept under about 75 characters a line." },
  { token: "text-small", className: "font-ui text-small", sample: "Small print, captions and helper text." },
  { token: "text-label", className: "font-mono-label text-label", sample: "DHA Phase 6 · 12 places" },
];

const radii = [
  { token: "rounded-control", className: "rounded-control" },
  { token: "rounded-media", className: "rounded-media" },
  { token: "rounded-container", className: "rounded-container" },
];

const areas = [
  { title: "Clifton", meta: "48 places", description: "Sea-facing cafés, late dinners and the promenade." },
  { title: "Saddar", meta: "31 places", description: "Old Karachi: markets, bookshops and street food." },
  { title: "DHA Phase 6", meta: "57 places", description: "Brunch spots, boutiques and quieter evenings." },
];

function Kit({ mode }: { mode: "Light" | "Dark" }) {
  return (
    <>
      <Section tone="white" size="lg">
        <Container>
          <Label as="p">{mode} mode</Label>
          <Reveal>
            <Heading as="h1" variant="display-xl" className="mt-4 max-w-4xl">
              The city, quietly curated
            </Heading>
          </Reveal>
          <p className="mt-6 max-w-prose font-ui text-body-lg text-muted-foreground">
            One large headline, one supporting sentence and one primary action.
            Everything else stays quiet.
          </p>
          <a
            href="#swatches"
            className="mt-8 inline-flex min-h-11 items-center rounded-control bg-primary px-6 font-ui text-body text-primary-foreground transition duration-fast ease-standard hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
          >
            Explore places
          </a>
        </Container>
      </Section>

      <Section tone="muted" size="md" id={mode === "Light" ? "swatches" : undefined}>
        <Container>
          <Heading variant="title">Colour tokens</Heading>
          <ul className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-9">
            {swatches.map((s) => (
              <li key={s.name}>
                <div className={`h-16 rounded-control border border-border ${s.className}`} />
                <Label as="p" className="mt-2">{s.name}</Label>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section tone="white" size="md">
        <Container>
          <Heading variant="title">Type scale</Heading>
          <RuledList className="mt-8">
            {typeScale.map((t) => (
              <li key={t.token} className="grid gap-2 py-6 md:grid-cols-[12rem_1fr] md:gap-8">
                <Label>{t.token}</Label>
                <p className={t.className}>{t.sample}</p>
              </li>
            ))}
          </RuledList>
        </Container>
      </Section>

      <Section tone="cream" size="lg">
        <Container>
          <Heading variant="display-md">Cream band with a ruled list</Heading>
          <RuledList className="mt-10">
            {areas.map((a) => (
              <RuledListItem key={a.title} href="#" {...a} />
            ))}
          </RuledList>
        </Container>
      </Section>

      <Section tone="ink" size="xl">
        <Container width="prose">
          <Reveal>
            <Heading variant="display-lg">
              A statement band holds one sentence and nothing else.
            </Heading>
          </Reveal>
          <Label as="p" className="mt-8">Ink tone · muted text and hairlines re-mapped</Label>
          <RuledList className="mt-8">
            <RuledListItem title="Static row" meta="No link" description="Rows without an href are plain, with no hover." />
          </RuledList>
        </Container>
      </Section>

      <Section tone="white" size="md">
        <Container>
          <Heading variant="title">Radius, overlay shadow and motion</Heading>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {radii.map((r) => (
              <div key={r.token}>
                <div className={`h-24 border border-border bg-muted ${r.className}`} />
                <Label as="p" className="mt-2">{r.token}</Label>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-media bg-popover p-6 text-popover-foreground shadow-overlay">
              <p className="font-ui text-body">shadow-overlay</p>
              <Label as="p" className="mt-1">Menus, popovers and dialogs only</Label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {(["duration-fast", "duration-base", "duration-slow"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`min-h-11 rounded-control border border-border px-4 font-ui text-small transition ease-standard hover:bg-muted active:scale-95 motion-reduce:transform-none ${d}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[0, 0.1, 0.2].map((delay) => (
              <Reveal key={delay} delay={delay}>
                <div className="rounded-media border border-border p-6">
                  <p className="font-ui text-body">Reveal</p>
                  <Label as="p" className="mt-1">delay {delay}s · plays once</Label>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main>
      <Kit mode="Light" />
      <div className="dark bg-background text-foreground">
        <Kit mode="Dark" />
      </div>
    </main>
  );
}
