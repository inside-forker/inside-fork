---
name: insidekarachi-design
description: Design system and UI rules for the insidekarachi.com Next.js site. Use this skill whenever building, redesigning, restyling or reviewing any page, section, component, layout, animation or styling in this repo, including small requests like "make this section look better", "add a new page", "change the button", "add an animation", or "this looks generic". Consult it before writing any JSX, Tailwind or CSS so every page stays visually consistent, even if the user never mentions a design system.
---

# InsideKarachi design system

The client wants the site to feel premium and calm, closer to Apple than to a SaaS template. The old UI leaned on glassmorphism, gradients and glows, which reads as generated. This skill exists so that every page, built in separate sessions over time, looks like it came from one hand.

The brand is fixed. Do not reinterpret it per page. When this skill and the generic `frontend-design` skill disagree, this skill wins, because the palette, fonts and bans below come from the client's brief.

## Before you write any UI

1. Read `app/globals.css` for the real tokens. Never rely on the hex values in this file if the CSS says otherwise.
2. Check what already exists in `components/ds` (the design-system kit, below), `components/ui` (shadcn primitives) and `lib/motion.ts`. Reuse before creating. `components/layout` holds the shared header and footer, not layout primitives.
3. If a needed pattern does not exist, say so and propose it before inventing it. A one-off style on one page is how the site drifts.
4. Do not copy patterns from pages that have not been migrated yet. Old pages still contain the banned styles. Legacy classes such as `.glass-card`, `.gradient-text*`, `.shadow-premium*`, `.premium-card`, `.glass*` and the old keyframes live in the `LEGACY` block at the end of `globals.css` only so those pages keep working. Never use them in new code, and never delete them unless every page using them has been migrated. The reference for "correct" is this file, `components/ds` and the already-redesigned pages (listed in `design-lint.paths.json`).
5. Read `references/patterns.md` when composing a page layout. It has the card-free alternatives.
6. Every public page must follow docs/public-site-brief.md: its section order, its one primary action and its memorable element. Before building, propose mockups (see workflow) and wait for approval.

## The kit

Import from `@/components/ds`. All are server components except `Reveal`. Run `npm run dev` and open `/design-preview` to see every piece in light and dark (the page 404s in production).

| Component | Use |
|---|---|
| `Section` | Full-width band. `tone`: `white` \| `cream` \| `ink` \| `muted`. `size`: `sm` \| `md` \| `lg` \| `xl` (vertical padding). The only place band padding is defined. |
| `Container` | Content column with the site gutters. `width`: `prose` (reading width) \| `default` \| `wide`. |
| `Heading` | Fraunces headline. `as`: `h1`–`h4`. `variant`: `display-xl` \| `display-lg` \| `display-md` \| `title`. Inherits the band's colour. |
| `Label` | Small mono metadata (`as`: `span`, `p`, `time`, `dt`, `dd`). Not an automatic eyebrow. |
| `Reveal` | One scroll reveal (fade + 16px rise), plays once, reduced motion keeps only the fade. `delay` in seconds for a small stagger. |
| `RuledList`, `RuledListItem` | Hairline-divided rows (`title`, `meta`, `description`, optional `href` makes the whole row the link). Replaces most card grids. |

Section tones re-map the theme tokens inside their band (`.ds-tone-*` in `globals.css`). Inside a cream or ink band, keep using `text-foreground`, `text-muted-foreground`, `border-border` and `bg-background`; they already resolve to the right colours. Never hard-code `text-cream` or `text-ink` inside a band.

| Token | Classes |
|---|---|
| Type scale | `text-display-xl`, `text-display-lg`, `text-display-md` (fluid), `text-title`, `text-body-lg`, `text-body`, `text-small`, `text-label`. `text-data` is the admin table size. |
| Fonts | `font-display`, `font-ui`, `font-mono-label` |
| Radius | `rounded-control` (8px, buttons and inputs) < `rounded-media` (16px, images and cards) < `rounded-container` (24px, large panels) |
| Shadow | `shadow-overlay` only, for menus, popovers and dialogs |
| Motion | `duration-fast` (150ms), `duration-base` (300ms), `duration-slow` (600ms), `ease-standard`. For framer-motion: `ease`, `duration`, `transition`, `revealVariants`, `revealViewport` from `@/lib/motion`. |

`cn()` in `lib/utils.ts` knows these names. If you add a token, register it there too, or tailwind-merge will drop classes beside it.

## The feel

Typography, whitespace, real photography and solid color blocks do the work. Nothing glows, floats on blur or fades between hues. Depth comes from contrast between flat sections and from hairline borders, not from shadows.

Pick one memorable element per page (a large headline, a full-bleed photo, one considered animation) and keep everything around it quiet. Boldness spent in five places reads as noise.

## Banned, always

These are the tells of a generated site. Do not use them in new code, and remove them from any file you touch.

- Gradients of any kind (`bg-gradient-*`, `linear-gradient`, `radial-gradient`, `from-`/`via-`/`to-`, gradient text)
- `backdrop-blur`, `backdrop-filter`, translucent "glass" panels
- Glows and blurred color blobs (`blur-*` on decorative elements, colored `box-shadow`, `drop-shadow` glows)
- Decorative shadows. Use none, or a hairline border. If a floating layer (menu, dialog) truly needs separation, use the one shadow token, `shadow-overlay`, not an arbitrary value.
- Arbitrary values for color, shadow, radius or timing (`shadow-[...]`, `bg-[#...]`, `duration-[...]`). Use tokens.
- Emojis as icons. Use Lucide.

## Color

| Role | Value | Use |
|---|---|---|
| Primary pink | `#FF184E` | Primary buttons, links, focus rings |
| Ink | `#13181C` | Text; the footer and dark statement or hero bands (with cream text) |
| Cream | `#F3F0DF` | Occasional accent band: at most one per page, never the footer |
| White | `#FFFFFF` | Page background and the default section background |
| Grey | `#F3F4F6` | Muted surfaces, secondary/accent |
| Border | `#E5E7EB` | Hairlines and dividers |
| Destructive | `#C52020` | Errors and destructive actions |

Success (dark green) and warning (dark amber) are for admin status badges only.

Section backgrounds:

- **White** is the default for every section.
- **Ink with cream text** is for the footer and for dark statement or hero bands (`Section tone="ink"`).
- **Cream** is an occasional accent: at most one cream band per page, and never the footer.

Always use the Tailwind/CSS token classes (`bg-primary`, `text-foreground`, and so on), never raw hex, so dark mode works. Dark mode uses a slightly brighter pink on a near-black background and must be checked on every page. The root layout currently forces light mode (`forcedTheme="light"`), so check dark by wrapping the content in a `dark` class, as `/design-preview` does.

Pink is scarce on purpose. It should cover well under 5% of any screen. If a screen has three pink things competing, two of them should be ink or grey. Scarcity is what makes the primary action obvious and the page feel expensive.

Do not add a second accent color. Do not tint ink toward a hue.

## Typography

| Class | Font | Role |
|---|---|---|
| `font-display` | Fraunces | Headlines and large editorial statements |
| `font-ui` | Instrument Sans | Body, navigation, buttons, forms |
| `font-mono-label` | IBM Plex Mono | Small metadata labels |

Headlines: large, tight tracking, generous line spacing below them. Let size contrast carry hierarchy (very large headline, comfortable body) instead of adding bold weights, colors or boxes.

Body: keep lines under about 75 characters. Give Fraunces body text a little more line-height than Instrument Sans.

Use only the type scale defined in the repo (see The kit). Do not invent sizes. The body font of old pages is still Inter (`font-sans`); migrated pages set `font-ui` on their own content.

Use the mono label for real metadata (a date, a neighborhood, a category, a count). Do not put an uppercase tracked eyebrow above every heading, and do not number sections (01, 02, 03) unless the content really is a sequence. A label earns its place by telling the reader something the heading does not. Do not accent a single word in a headline with italic or color.

## Layout and composition

Build pages from the primitives in `components/ds` (`Section`, `Container`, `Heading`, `Label`, `RuledList`). Do not hand-roll section padding or max-widths.

Structure comes from full-width bands with large vertical padding, using the section backgrounds from Color (white by default). Vary the rhythm: not every band needs the same height or the same internal layout. Three identical stacked bands is still a template.

Cards are for discrete objects people open or compare, such as a listing or an event. They are not a default container for text, features, stats or steps. For everything else use ruled lists with hairline dividers, large type with whitespace, split layouts (image beside text), full-bleed photography, or a plain table. See `references/patterns.md`.

Never put a card inside a card. Never use one identical rounded card repeated in a grid as the whole page.

Radius comes from the radius tokens (`rounded-control`, `rounded-media`, `rounded-container`), and the scale has hierarchy: larger on media and containers, smaller on controls. Do not apply one radius to everything.

Photography should be real and large, full-bleed where possible. Use `next/image` with correct `sizes` and meaningful `alt`.

## Motion

The goal is smooth and responsive, not decorative. Two kinds of motion exist:

**Motion that answers an action** (hover, press, open, close, expand, route change): always welcome, subtle, fast. Use it freely.

**Motion that plays on its own** (scroll reveals, entrances): use sparingly. One orchestrated moment per page, such as a hero entrance or a single staggered list, lands better than every section sliding up. Fade-up on each section and hover lifts on every card are the generic default and read as generated.

Rules:

- Use `Reveal` from `components/ds` and the tokens in `lib/motion.ts`, built on the installed `framer-motion` package (import from `"framer-motion"`). Do not add another animation library, and do not add new keyframes to `globals.css`. Legacy keyframes there are being phased out; never use them in new code.
- One easing curve and three durations, defined once as tokens: CSS `--ease-standard` and `--duration-fast/base/slow` (150/300/600ms), Tailwind `ease-standard` and `duration-fast/base/slow`, and the same values in `lib/motion.ts`. Never type a raw duration or cubic-bezier in a component. `lib/utils/listing-animations.ts` is legacy; do not use it in new code.
- Move things with `transform` and `opacity` only, so animation stays on the GPU. Color changes on interactive states are fine. Never animate width, height, top or left.
- Scroll reveals play once, never replay on scroll back.
- Respect `prefers-reduced-motion` by removing movement and keeping any essential state change.
- Smooth scrolling (Lenis), if enabled, is configured once at the root layout and disabled under reduced motion. Do not configure it per page.

## Copy

Words in the interface exist to help someone act. Use plain language, sentence case and active verbs. A button says what happens ("Save changes", not "Submit"). The same action keeps the same name everywhere. Error messages say what went wrong and how to fix it, without apologizing. Empty states point to the next action.

Keep existing content and behavior unless asked to change it. A redesign changes how things look and feel, not what the site says or does.

## Quality floor

Every page meets this before it is considered done:

- Works from 390px wide up to 1440px, with no horizontal scroll
- Visible keyboard focus (pink ring), logical tab order, semantic HTML and headings
- Text contrast meets WCAG AA in light and dark mode
- Tap targets at least 44px on mobile
- Images sized and lazy-loaded, no layout shift
- No console errors; forms, auth and payment flows still work

## How to work on a page

1. State briefly which layout primitives and patterns you will use and where the one memorable element goes.
2. Build with existing components and tokens only.
3. If Playwright is available, screenshot at 1440px and 390px, in light and dark mode, then critique honestly against this file and fix what is off. Remove one decorative thing before finishing.
4. Add the migrated page's files (or folders) to `design-lint.paths.json`, then run `npm run design-lint` and `npm run build`. On a low-memory machine the build may need `NODE_OPTIONS=--max-old-space-size=6144`. Fix failures before saying the work is done, because changes may go straight to production. `npm run design-lint -- --report` shows what is left across the unmigrated code.
5. Finish with a short summary: what changed, any new pattern proposed, anything left inconsistent that you noticed but did not touch.

## Definition of done

- [ ] No banned pattern in any file touched
- [ ] Only tokens and existing components used, nothing invented silently
- [ ] Pink used sparingly and only for action, links and focus
- [ ] No cards except real objects
- [ ] Motion uses the shared tokens and respects reduced motion
- [ ] Checked at mobile and desktop widths, light and dark
- [ ] Page files listed in `design-lint.paths.json` and `npm run design-lint` passes
- [ ] Build passes
