---
name: insidekarachi-design
description: Design system and UI rules for the insidekarachi.com Next.js site. Use this skill whenever building, redesigning, restyling or reviewing any page, section, component, layout, animation or styling in this repo, including small requests like "make this section look better", "add a new page", "change the button", "add an animation", or "this looks generic". Consult it before writing any JSX, Tailwind or CSS so every page stays visually consistent, even if the user never mentions a design system.
---

# InsideKarachi design system

The client wants the site to feel premium and calm, closer to Apple than to a SaaS template. The old UI leaned on glassmorphism, gradients and glows, which reads as generated. This skill exists so that every page, built in separate sessions over time, looks like it came from one hand.

The brand is fixed. Do not reinterpret it per page. When this skill and the generic `frontend-design` skill disagree, this skill wins, because the palette, fonts and bans below come from the client's brief.

## Before you write any UI

1. Read `app/globals.css` for the real tokens. Never rely on the hex values in this file if the CSS says otherwise.
2. Check what already exists in `components/ui`, `components/layout` and `components/motion` (and `lib/motion.ts`). Reuse before creating.
3. If a needed pattern does not exist, say so and propose it before inventing it. A one-off style on one page is how the site drifts.
4. Do not copy patterns from pages that have not been migrated yet. Old pages still contain the banned styles, and legacy classes such as `.glass-card`, `.gradient-text*`, `.premium-gradient-*`, `.shadow-premium*` and the old keyframes still exist in `globals.css` only so those pages keep working. Never use them in new code, and never delete them unless every page using them has been migrated. The reference for "correct" is this file plus the already-redesigned pages.
5. Read `references/patterns.md` when composing a page layout. It has the card-free alternatives.

## The feel

Typography, whitespace, real photography and solid color blocks do the work. Nothing glows, floats on blur or fades between hues. Depth comes from contrast between flat sections and from hairline borders, not from shadows.

Pick one memorable element per page (a large headline, a full-bleed photo, one considered animation) and keep everything around it quiet. Boldness spent in five places reads as noise.

## Banned, always

These are the tells of a generated site. Do not use them in new code, and remove them from any file you touch.

- Gradients of any kind (`bg-gradient-*`, `linear-gradient`, `radial-gradient`, `from-`/`via-`/`to-`, gradient text)
- `backdrop-blur`, `backdrop-filter`, translucent "glass" panels
- Glows and blurred color blobs (`blur-*` on decorative elements, colored `box-shadow`, `drop-shadow` glows)
- Decorative shadows. Use none, or a hairline border. If a floating layer (menu, dialog) truly needs separation, use the one shadow token from `globals.css`, not an arbitrary value.
- Arbitrary values for color, shadow, radius or timing (`shadow-[...]`, `bg-[#...]`, `duration-[...]`). Use tokens.
- Emojis as icons. Use Lucide.

## Color

| Role | Value | Use |
|---|---|---|
| Primary pink | `#FF184E` | Primary buttons, links, focus rings |
| Ink | `#13181C` | Text, and the dark section background |
| Cream | `#F3F0DF` | Warm section background |
| White | `#FFFFFF` | Page background |
| Grey | `#F3F4F6` | Muted surfaces, secondary/accent |
| Border | `#E5E7EB` | Hairlines and dividers |
| Destructive | `#C52020` | Errors and destructive actions |

Success (dark green) and warning (dark amber) are for admin status badges only.

Always use the Tailwind/CSS token classes (`bg-primary`, `text-foreground`, and so on), never raw hex, so dark mode works. Dark mode uses a slightly brighter pink on a near-black background and must be checked on every page.

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

Use only the type scale defined in the repo. Do not invent sizes.

Use the mono label for real metadata (a date, a neighborhood, a category, a count). Do not put an uppercase tracked eyebrow above every heading, and do not number sections (01, 02, 03) unless the content really is a sequence. A label earns its place by telling the reader something the heading does not. Do not accent a single word in a headline with italic or color.

## Layout and composition

Build pages from the layout primitives (`Section`, `Container`, `Heading`, and so on) once they exist. Do not hand-roll section padding or max-widths.

Structure comes from full-width bands that alternate white, cream and ink, with large vertical padding. Vary the rhythm: not every band needs the same height or the same internal layout. Three identical stacked bands is still a template.

Cards are for discrete objects people open or compare, such as a listing or an event. They are not a default container for text, features, stats or steps. For everything else use ruled lists with hairline dividers, large type with whitespace, split layouts (image beside text), full-bleed photography, or a plain table. See `references/patterns.md`.

Never put a card inside a card. Never use one identical rounded card repeated in a grid as the whole page.

Radius comes from the radius tokens, and the scale should have hierarchy: larger on media and containers, smaller on controls. Do not apply one radius to everything.

Photography should be real and large, full-bleed where possible. Use `next/image` with correct `sizes` and meaningful `alt`.

## Motion

The goal is smooth and responsive, not decorative. Two kinds of motion exist:

**Motion that answers an action** (hover, press, open, close, expand, route change): always welcome, subtle, fast. Use it freely.

**Motion that plays on its own** (scroll reveals, entrances): use sparingly. One orchestrated moment per page, such as a hero entrance or a single staggered list, lands better than every section sliding up. Fade-up on each section and hover lifts on every card are the generic default and read as generated.

Rules:

- Use `components/motion` and `lib/motion.ts`, built on the `framer-motion` package already installed in this repo (check `package.json` for the exact import path). Do not add another animation library, and do not add new keyframes to `globals.css`. Legacy keyframes there are being phased out; never use them in new code.
- One easing curve and three durations (fast 150ms, base 300ms, slow 600ms), defined once as tokens. Never type a raw duration or cubic-bezier in a component.
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
4. Run `npm run build`. If `npm run design-lint` exists, run it too. Fix failures before saying the work is done, because changes may go straight to production.
5. Finish with a short summary: what changed, any new pattern proposed, anything left inconsistent that you noticed but did not touch.

## Definition of done

- [ ] No banned pattern in any file touched
- [ ] Only tokens and existing components used, nothing invented silently
- [ ] Pink used sparingly and only for action, links and focus
- [ ] No cards except real objects
- [ ] Motion uses the shared tokens and respects reduced motion
- [ ] Checked at mobile and desktop widths, light and dark
- [ ] Build passes
