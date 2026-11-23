---
name: insidekarachi-design
description: Design system and UI rules for the insidekarachi.com Next.js site. Use this skill whenever building, redesigning, revamping, restyling or reviewing any page, section, component, layout, animation or styling in this repo, including small requests like "make this section look better", "add a new page", "revamp the events page", "change the button", "add an animation", or "this looks generic". Consult it before writing any JSX, Tailwind or CSS, and before making mockups, so every page stays visually consistent, even if the user never mentions a design system.
---

# InsideKarachi design system

The client wants the site to feel premium and calm, closer to Apple than to a SaaS template. The old UI leaned on glassmorphism, gradients and glows, which reads as generated. This skill exists so that every page, built in separate sessions over time, looks like it came from one hand.

The brand is fixed. Do not reinterpret it per page. When this skill and the generic `frontend-design` skill disagree, this skill wins, because the palette, fonts and bans below come from the client.

## Client decisions (these win)

The client set these during the November 2026 revamp rounds (homepage INSID-259, /events INSID-258, event page INSID-237). They override docs/public-site-brief.md, `references/patterns.md` and anything older in this file. When the client agrees a new UI rule, add it to this list so every session follows it.

- **Mockups before code.** A revamp or redesign request starts with 3 or 4 distinct directions on a design canvas artifact. Each direction gets a phone board (390px) and a desktop board (1440px). Design mobile first and use real live data: real names, banners and prices, with grey blocks only as placeholders. Nothing is implemented until the client picks a direction.
  - Publish fast. Don't run local render or screenshot polishing loops unless asked; fix details after feedback.
  - Track the mockups on their own Coral9 ticket and leave it In Progress until the pick. The build gets a new ticket.
  - Each new round gets its own canvas page, and earlier rounds stay.
- **Inter only**, the same face as the mobile app (`font-sans`, weights 400 to 700).
  - Display headings are bold with tight tracking, titles are semibold, body is regular.
  - Small metadata uses semibold uppercase labels with wide tracking.
  - Fraunces, Instrument Sans and IBM Plex Mono are not used on new or revamped pages (see Typography).
- **Light mode only.** No dark pages. Ink surfaces are fine as accents, such as a strip, a featured tile or the footer.
- **Pink has to show.**
  - Every page's own primary action is solid pink with white text. The header's pink button doesn't count.
  - Selected states (chips, filters, tabs) are solid pink.
  - Body content (titles, lead text, numerals) stays black, never pink.
  - Inside a dense component such as a ticket card, keep one pink (its action) and use ink for picked items.
  - No large pink slabs.
  - Exception (INSID-273): on phones the homepage headline's cycling last word is pink, on a cream sticker with its app icon. It runs once and stops on "Karachi.".
- **Visual, not texty.** Lead with real photos, banners, colour and shape. Keep details to one or two lines, and keep descriptions short and clamped. Stacked text blocks, grey label/value boxes and a heading over every block read as "dumped".
- **Compact.** People should see many items and their prices without much scrolling. Nothing oversized, no long descriptions. On phones, the page title and search share one row.
- **Hairlines, not outlines.** Borders are 1px `border-border` (#E5E7EB) or none. Never 2px ink outlines.
- **No carousels on the landing page.**
  - The homepage (`/`) has no carousels, hero sliders or horizontal scroll rows. It uses grids, photo bentos and short stacks.
  - Other pages may use a carousel where it helps.
  - Filter chips wrap instead of scrolling.
- **Events are their banner.**
  - Show every event's whole banner in its own shape (16:9 or 2.4:1).
  - Never crop a banner to a thumbnail or shrink it to a listing-style tile.
  - Never use calendars, date rails or date blocks.
  - On desktop, place banners in justified rows: each item's flex-grow is its aspect ratio, so a row shares one height and nothing is cropped.
  - The details are white text straight on the banner: the name, with the date under it, at the bottom left, and the price at the bottom right. No label box, no caption under the banner and no venue.
  - **/events has one compact spotlight** (INSID-278, 23 Nov 2026), on a short black band between the filters and the wall, matching the /discounts band.
    - Phones show the event's banner card (as in the wall), about 270px in all. Desktop shows a smaller whole banner (416px wide) beside the date, name, venue, price and a pink Get tickets.
    - It's the soonest event with tickets, shown only on the unfiltered list and only when there are 2 or more events. It never repeats in the wall.
    - Keep it compact: the larger round 11 version was rejected for taking too much space.
- **Category icons** are the app's illustrated PNG pack (`insidekhi-reactnative/assets/icons`, copied into `public/`), never Lucide. Lucide is only for generic UI icons such as search, arrows and menu.
- **Text over an image** is white and sits straight on the image, with a soft dark text shadow so it stays readable. No label boxes and no gradient scrims.
- **Discounts and deals** (INSID-262):
  - No coupon or ticket styling (tear lines, stubs, notches), and no pills, chips or badges on deal cards. Use at most three filter menus.
  - Deal photos are partner-feed images, not designed posters. Run them across the top of a card or as a row thumbnail, never as a full-bleed hero or a banner wall, and never put text on them. Photos and place names must be big enough to read.
  - The % comes first on every card, at normal text size (about 14 to 20px), never as a giant display number. Make big discounts stand out through shape or colour, not type size.
  - Lead with the discount, not the rupee saving, and don't sort by saving by default.
  - **/discounts is a browse page at /events scale** (round 12, direction C, 23 Nov 2026). Round 9's Y used the homepage's marketing scale (48px headings, a hero deal photo, deep padding) and looked awful built.
    - The top is the /events top on white: the title and search, then the grey filter pills.
    - Saved cards are a small strip of card art on white (All discounts, Both cards, each card, then Add), with a pink ring on the picked one and one line under it ("Both cards · 525 offers · Edit cards"). Guests see bank logos, the offer count and a pink "Add your card".
    - Half off or more sits on a short black band that holds only those deals: a swipe row on phones, 3 to 4 across on desktop.
    - 40% off is a grid of smaller cards on white, and the rest are rows with the photo on the left.
    - Sections open with a small header (17–20px title, count, "See all →"), never the homepage `SectionHeader`. Cards in a section are all the same size: no lead or hero deal.
    - No cream band, no black header, and no black or cream cards on white.
  - Big deals get their own sections, and each section looks different.
  - Show each place once, led by its best offer. A chain's branches and other banks' offers go in the deal sheet.

These decisions replace several parts of the brief:
- the one pink action per screen
- Fraunces display type (for example, the home headline and the /listings index)
- the /events date rail and 2-up poster grid
- checking dark mode

## Before you write any UI

1. Read `app/globals.css` for the real tokens. Never rely on the hex values in this file if the CSS says otherwise.
2. Check what already exists in `components/ds` (the design-system kit, below), `components/ui` (shadcn primitives) and `lib/motion.ts`. Reuse before creating. `components/layout` holds the shared header and footer, not layout primitives.
3. If a needed pattern does not exist, say so and propose it before inventing it. A one-off style on one page is how the site drifts.
4. Do not copy patterns from pages that have not been migrated yet. Old pages still contain the banned styles.
   - Legacy classes such as `.glass-card`, `.gradient-text*`, `.shadow-premium*`, `.premium-card`, `.glass*` and the old keyframes live in the `LEGACY` block at the end of `globals.css` only so those pages keep working. Never use them in new code. Never delete them unless every page using them has been migrated.
   - The reference for "correct" is this file, `components/ds` and the already-redesigned pages (listed in `design-lint.paths.json`).
5. Read `references/patterns.md` when composing a page layout. It has the card-free alternatives.
6. Use docs/public-site-brief.md for each page's purpose, section order and primary action, except where Client decisions above say otherwise. For a revamp, make mockups first and wait for the client's pick.

## The kit

Import from `@/components/ds`. All are server components except `Reveal`. Run `npm run dev` and open `/design-preview` to see every piece (the page 404s in production).

| Component | Use |
|---|---|
| `Section` | Full-width band. `tone`: `white` \| `cream` \| `ink` \| `muted`. `size`: `sm` \| `md` \| `lg` \| `xl` (vertical padding). The only place band padding is defined. |
| `Container` | Content column with the site gutters. `width`: `prose` (reading width) \| `default` \| `wide`. |
| `Heading` | Headline. `as`: `h1`–`h4`. `variant`: `display-xl` \| `display-lg` \| `display-md` \| `title`. Inherits the band's colour. It sets Fraunces, so on new or revamped pages pass `className="font-sans font-bold tracking-tight"`. |
| `Label` | Small metadata (`as`: `span`, `p`, `time`, `dt`, `dd`). Not an automatic eyebrow. It sets IBM Plex Mono, so on new or revamped pages pass `className="font-sans font-semibold uppercase tracking-wider"`. |
| `Reveal` | One scroll reveal (fade + 16px rise), plays once, reduced motion keeps only the fade. `delay` in seconds for a small stagger. |
| `RuledList`, `RuledListItem` | Hairline-divided rows (`title`, `meta`, `description`, optional `href` makes the whole row the link). For lists that really are text. |

Section tones re-map the theme tokens inside their band (`.ds-tone-*` in `globals.css`). Inside a cream or ink band, keep using `text-foreground`, `text-muted-foreground`, `border-border` and `bg-background`; they already resolve to the right colours. Never hard-code `text-cream` or `text-ink` inside a band.

| Token | Classes |
|---|---|
| Type scale | `text-display-xl`, `text-display-lg`, `text-display-md` (fluid), `text-title`, `text-body-lg`, `text-body`, `text-small`, `text-label`. `text-data` is the admin table size. |
| Fonts | `font-sans` (Inter) on new and revamped pages. `font-display`, `font-ui` and `font-mono-label` stay only where they already are (the shared header, footer and invite pages). |
| Radius | `rounded-control` (8px, buttons and inputs) < `rounded-media` (16px, images and cards) < `rounded-container` (24px, large panels) |
| Shadow | `shadow-overlay` only, for menus, popovers and dialogs |
| Motion | `duration-fast` (150ms), `duration-base` (300ms), `duration-slow` (600ms), `ease-standard`. For framer-motion: `ease`, `duration`, `transition`, `revealVariants`, `revealViewport` from `@/lib/motion`. |

`cn()` in `lib/utils.ts` knows these names. If you add a token, register it there too, or tailwind-merge will drop classes beside it.

## The feel

Typography, whitespace, real photography and solid color blocks do the work. Nothing glows, floats on blur or fades between hues. Depth comes from contrast between flat sections and from hairline borders, not from shadows.

Pick one memorable element per page (a large headline, a full-bleed photo, one considered animation) and keep everything around it quiet. Boldness spent in five places reads as noise.

## Banned, always

These are the tells of a generated site. Do not use them in new code, and remove them from any file you touch.

- Gradients of any kind (`bg-gradient-*`, `linear-gradient`, `radial-gradient`, `from-`/`via-`/`to-`, gradient text, gradient scrims over photos)
- `backdrop-blur`, `backdrop-filter`, translucent "glass" panels
- Glows and blurred color blobs (`blur-*` on decorative elements, colored `box-shadow`, `drop-shadow` glows)
- Decorative shadows. Use none, or a hairline border. If a floating layer (menu, dialog) truly needs separation, use the one shadow token, `shadow-overlay`, not an arbitrary value.
- Arbitrary values for color, shadow, radius or timing (`shadow-[...]`, `bg-[#...]`, `duration-[...]`). Use tokens.
- Emojis as icons. Use Lucide for generic UI icons and the app's icon pack for categories.

## Color

| Role | Value | Use |
|---|---|---|
| Primary pink | `#FF184E` | Primary actions, selected states, links, focus rings |
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

Always use the Tailwind/CSS token classes (`bg-primary`, `text-foreground`, and so on), never raw hex. The site is light mode only: the root layout forces light (`forcedTheme="light"`), so design and check light only.

Pink follows Client decisions: it goes on every page's primary action and on selected states, stays off body text and never fills large slabs.

Do not add a second accent color. Do not tint ink toward a hue.

## Typography

Use Inter (`font-sans`) only, as in the mobile app.
- Hierarchy comes from size and weight: bold display headings with tight tracking, semibold titles and regular body.
- Use small semibold uppercase labels with wide tracking for real metadata (a date, an area, a category, a count).
- Keep body lines under about 75 characters.

Use the repo's type scale (`text-display-*`, `text-title`, `text-body*`, `text-small`, `text-label`) where it fits. Don't invent a new size for each element.

Fraunces (`font-display`), Instrument Sans (`font-ui`) and IBM Plex Mono (`font-mono-label`) came from the INSID-244 foundation and are still on the shared header, footer and invite pages.
- Don't use them on new or revamped pages.
- Don't switch those shared pieces to Inter as a side effect of other work. Ask the client first.

Do not put an uppercase eyebrow above every heading, and do not number sections (01, 02, 03) unless the content really is a sequence. A label earns its place by telling the reader something the heading does not. Do not accent a single word in a headline with italic or color.

## Layout and composition

Build pages from `Section` and `Container` in `components/ds`, with `Heading` and `Label` set to Inter (see The kit). Do not hand-roll section padding or max-widths.

Structure comes from full-width bands with large vertical padding, using the section backgrounds from Color (white by default). Vary the rhythm: not every band needs the same height or the same internal layout. Three identical stacked bands is still a template.

Cards are for discrete objects people open or compare, such as a listing or an event. They are not a default container for text, features, stats or steps. For everything else, use one of these (see `references/patterns.md`):
- photos and bentos
- split layouts (image beside text)
- chips
- ruled lists with hairline dividers
- a plain table

Never put a card inside a card. Never use one identical rounded card repeated in a grid as the whole page.

Radius comes from the radius tokens (`rounded-control`, `rounded-media`, `rounded-container`), and the scale has hierarchy: larger on media and containers, smaller on controls. Do not apply one radius to everything.

Photography should be real and large, full-bleed where possible. Use `next/image` with correct `sizes` and meaningful `alt`.

## Motion

The goal is smooth and responsive, not decorative. Two kinds of motion exist:

**Motion that answers an action** (hover, press, open, close, expand, route change): always welcome, subtle, fast. Use it freely.

**Motion that plays on its own** (scroll reveals, entrances): use sparingly. One orchestrated moment per page, such as a hero entrance or a single staggered list, lands better than every section sliding up. Fade-up on each section and hover lifts on every card are the generic default and read as generated.

Rules:

- Use `Reveal` from `components/ds` and the tokens in `lib/motion.ts`, built on the installed `framer-motion` package (import from `"framer-motion"`).
  - Do not add another animation library, and do not add new keyframes to `globals.css`.
  - Legacy keyframes in `globals.css` are being phased out; never use them in new code.
- Timing uses one easing curve and three durations, each defined once as a token:
  - CSS: `--ease-standard` and `--duration-fast/base/slow` (150/300/600ms)
  - Tailwind: `ease-standard` and `duration-fast/base/slow`
  - `lib/motion.ts`: the same values
- Never type a raw duration or cubic-bezier in a component. `lib/utils/listing-animations.ts` is legacy; do not use it in new code.
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
- Text contrast meets WCAG AA
- Tap targets at least 44px on mobile
- Images sized and lazy-loaded, no layout shift
- No console errors; forms, auth and payment flows still work

## How to work on a page

1. For a revamp or redesign, start with mockups (see Client decisions) and build only the direction the client picks.
2. State briefly which layout primitives and patterns you will use and where the one memorable element goes.
3. Build with existing components and tokens only.
4. If Playwright is available, screenshot at 1440px and 390px, then critique honestly against this file and fix what is off. Remove one decorative thing before finishing.
5. Add the migrated page's files (or folders) to `design-lint.paths.json`, then run `npm run design-lint` and `npm run build`.
   - On a low-memory machine the build may need `NODE_OPTIONS=--max-old-space-size=6144`.
   - Fix failures before saying the work is done, because changes may go straight to production.
   - `npm run design-lint -- --report` shows what is left across the unmigrated code.
6. Finish with a short summary: what changed, any new pattern proposed, anything left inconsistent that you noticed but did not touch.

## Definition of done

- [ ] No banned pattern in any file touched
- [ ] Only tokens and existing components used, nothing invented silently
- [ ] Inter only; pink on the primary action and selected states; body text black
- [ ] No cards except real objects; events shown as their whole banner
- [ ] Motion uses the shared tokens and respects reduced motion
- [ ] Checked at mobile and desktop widths
- [ ] Page files listed in `design-lint.paths.json` and `npm run design-lint` passes
- [ ] Build passes
