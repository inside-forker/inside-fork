# 02 — Admin design system

Everything here maps to tokens in `app/globals.css` and `tailwind.config.ts`. Values in brackets are what the token resolves to in light mode, for reference only. Code never uses hex.

Applies to `/admin/*` and the admin/staff `/dashboard` overview, through the new admin shell.

## Round 2: what was built (Nov 2026)

The client asked for a more premium look after round 1, and these round 2 decisions are what the code uses. Where they differ from the sections below, **this section wins**. The component APIs are in `03-components.md`.

| Area | As built |
| --- | --- |
| Sidebar | **Ink** (`bg-foreground`) with `text-background/70` links. Active link gets `bg-background/10` and a 2px pink bar. Queue counts are pink text on `primary/15`. |
| Canvas | Page background is `bg-muted/50`. Content sits in **white panels** (`AdminSection`, tables) with a 1px border and `rounded-lg`. Depth comes from tonal steps, never shadows. |
| Top bar | White, 56px, border-bottom, sticky. Tables stick under it via `--admin-sticky-top`. |
| Page title | 24px, 30px from md, semibold, tight tracking, with a small eyebrow above (nav group or date). |
| Metrics | One bordered panel split by hairlines (`gap-px` over `bg-border`). 30px tabular value. Change shown as a pill (`success/10` up-good, `destructive/10` down-bad). Optional `Meter`. Queue counts are pink. |
| Status | **Tinted tags** (24px, `rounded-md`, 10% tone fill, dot plus label). The `inline` variant exists for dense text. |
| Meters | 6px track on `muted`. Ink fill, turning pink at 90% or more. |
| Bulk bar | **Ink** bar (`bg-foreground`) with outline-on-ink `BulkAction` buttons. Selected rows get a `primary/5` tint and a 3px pink inset marker. |
| Filter chips | Dashed border when empty ("+ Status"). Solid when applied, with an ink value pill and a clear ✕. |
| Overlays | Scrim `foreground/45`, no blur. Drawers 576/672px from the right, modals centred. `shadow-xl` only on these. |
| Destructive | `--destructive` is now `0 72% 45%` (#C52020): 5.8:1 as text, 5.6:1 behind white text. Open question 1 is resolved. |
| Checkbox | `AdminCheckbox`: 16px, 4px radius, `foreground/25` border, pink when on, indeterminate supported. |

## 1. Colour

### 1.1 Token additions (approved)

Two tokens, light and dark. Nothing else is added.

```css
:root  { --success: 152 62% 26%; /* 6.47:1 on white */ --warning: 30 92% 30%; /* 6.39:1 on white */ }
.dark  { --success: 152 55% 52%; /* 9.28:1 on bg   */ --warning: 38 92% 58%; /* 10.42:1 on bg  */ }
```

Tailwind: `success: 'hsl(var(--success) / <alpha-value>)'`, `warning: …`. Badge's hardcoded `emerald-500` moves to `success`.

### 1.2 Role map

| Role | Token / class | Notes |
| --- | --- | --- |
| Page canvas | `bg-background` | |
| Recessed strip: sidebar, table header, filter row, read-only field | `bg-muted/50` | The only tonal step for structure |
| Row hover, nav hover, ghost hover | `bg-muted` | |
| Selected row | `bg-primary/5` + checked checkbox | Pink as key state |
| Active nav item | `bg-muted`, `text-foreground`, `font-medium`, 2px `bg-primary` bar on the left edge | |
| Text, primary | `text-foreground` | 17.97:1 |
| Text, secondary and meta | `text-muted-foreground` | 6.01:1 |
| Text, disabled | `text-muted-foreground` + `opacity-60` on the control | Exempt from AA |
| Hairline | `border-border` | Structure only (1.24:1, decorative) |
| Input boundary | `border-input`, hover `border-foreground/20` | Label identifies the field |
| **Primary action** | `bg-foreground text-background` | 17.97:1. Approved over pink. |
| Secondary action | `bg-background border-border text-foreground` | |
| Destructive action | `bg-destructive text-destructive-foreground` | See open question Q1 |
| Link | `text-foreground underline underline-offset-4 decoration-border`, hover `decoration-foreground` | Not pink. Pink text fails AA. |
| Focus | `outline-2 outline-ring outline-offset-2` | Pink, 3.81:1 against white. Passes the 3:1 UI rule. |
| Key state (attention counts, selected tab marker, checkbox, switch on, active nav bar) | `primary` | Never as body text, never as a large fill |
| Overlay behind modal/drawer | `bg-foreground/40` | No blur |
| Skeleton block | `bg-muted` | |

### 1.3 Status tones (`StatusBadge`)

A 6px dot plus a label in `text-data font-medium`. **No pill background in tables.** Detail headers may add `bg-{tone}/10` with `rounded-sm px-2`.

| Tone | Token | Statuses |
| --- | --- | --- |
| positive | `success` | active, published, approved, verified, paid, checked in |
| attention | `warning` | pending, in review, unpaid, expiring soon |
| negative | `destructive` | rejected, flagged, failed, banned, refunded |
| neutral | `muted-foreground` | draft, scheduled |
| ended | `muted-foreground`, hollow dot (1px ring) | expired, archived, cancelled |

Label text always uses the tone colour, except `destructive` (see Q1), which uses `foreground` text with a destructive dot so it passes AA today.

### 1.4 Charts (Recharts, already installed)

Primary series `foreground`, comparison series `muted-foreground`, highlighted point or bar `primary`. Gridlines `border`, horizontal only. Axis text `text-xs muted-foreground tabular-nums`. Solid fills only, no area gradients. Tooltips are level-1 popovers. Use a chart only when the shape over time is the information.

## 2. Typography

Inter via `--font-sans` (already loaded). Weights **400 / 500 / 600 only**. Admin drops `font-bold`, `font-extrabold`, `uppercase tracking-*` and gradient text.

| Role | Class | Size / line | Weight |
| --- | --- | --- | --- |
| Page title (one per page) | `text-2xl tracking-tight` | 24 / 32 | 600 |
| Section and drawer/modal title | `text-lg` | 18 / 28 | 600 |
| Group heading | `text-sm` | 14 / 20 | 600 |
| Body, inputs, buttons | `text-sm` | 14 / 20 | 400 (buttons 500) |
| **Data**: table cells, chips, status, meta | `text-data` *(new scale step)* | 13 / 20 | 400 / 500 |
| Column header, field hint, caption | `text-xs` | 12 / 16 | 500 headers, 400 hints |
| Metric value | `text-2xl tabular-nums` | 24 / 32 | 600 |

Scale addition in `tailwind.config.ts` → `fontSize: { data: ['0.8125rem', { lineHeight: '1.25rem' }] }`. **12px is the floor**, so the 265 uses of `text-[8–11px]` go.

Numerals: `tabular-nums` on every number in tables, metrics, money, counts, times and pagination. Numeric columns are right-aligned. Formats: `Rs 4,500` (en-PK grouping), `Sat 21 Nov, 7:00 pm`, relative times only for under 7 days ("3 h ago").

## 3. Space, size, shape

**Spacing (4/8 grid).** Allowed Tailwind steps are `1 2 3 4 6 8 12 16`, which is 4, 8, 12, 16, 24, 32, 48 and 64px. Halves (`0.5`, `1.5`, `2.5`) and `5`, `7` are out.

| Use | Value |
| --- | --- |
| Inline gap (icon↔label, dot↔label) | 8 (`gap-2`) |
| Label → input | 8 |
| Field → field (forms) | 24 |
| Field → field (dense filters) | 12 |
| Group → group inside a section | 32 |
| Section → section | 48 |
| Page gutter | 24 (`px-6`) ≥ md, 16 below |
| Table cell | `px-3`, row height via control scale |

**Control heights.**

| Size | Height | Use |
| --- | --- | --- |
| sm | 28 (`h-7`) | Row actions, chips, segmented controls in tables |
| md | 32 (`h-8`) | **Default.** Toolbars, filters, table header actions. |
| lg | 36 (`h-9`) | Form inputs and form footer buttons |
| Below `md` | 40 (`h-10`) | All interactive controls, for touch |

Table rows: 44 default (`h-11`), 36 compact. Topbar 56 (`h-14`). Sidebar 240 (`w-60`). Reading width for forms and details: `max-w-3xl`.

**Radii** (from `--radius: 0.75rem`, unchanged): `rounded-sm` (8) for controls, inputs, chips and menu items. `rounded-lg` (12) for panels, popovers, menus, modals and image thumbs. `rounded-full` for dots, avatars and switches. Checkboxes use `rounded` (4), because 8px would make a 16px box a circle. Admin doesn't use `rounded-md`, `-xl`, `-2xl` or `-3xl`.

**Borders.** 1px `border-border` everywhere. The only 2px marks are the focus outline and the active nav and tab markers.

**Icons.** `lucide-react` only. 16px with 13–14px text, 14px inside 12px chips, 20px only in empty states. One stroke weight, 1.75, set once on the shell (`.lucide { stroke-width: 1.75 }` scoped to the admin root). Icons inherit `currentColor` and never sit in a tinted circle.

## 4. Elevation

| Level | What | Treatment |
| --- | --- | --- |
| 0 | Everything on the page: sidebar, header, tables, sections | Flat. Hairlines and `muted/50` steps. **No shadow, no hover shadow.** |
| 1 | Menu, select, popover, tooltip, combobox, toast | `bg-popover border shadow-md rounded-lg` |
| 2 | Modal, drawer | `bg-background border shadow-xl`, overlay `bg-foreground/40` |

Shadows are Tailwind's neutral defaults. Sticky headers separate with `border-b`, not shadow. `glass-card`, `shadow-premium` and `backdrop-blur` aren't used in admin.

## 5. Motion

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| fast | 120ms | ease-out | Colour, background and border on hover/press. Checkbox, switch. All exits. |
| base | 160ms | ease-out | Menus and popovers (opacity + 4px translate), tab marker, bulk-action bar (opacity + 8px rise) |
| slow | 200ms | ease-out | Drawer (translate-x full), modal (opacity + scale .98→1) |

Implemented with `tailwindcss-animate` `data-[state]` classes on Radix parts. framer-motion is removed from admin surfaces (467 uses).

**Never animated:** page or list entrances, staggers, hover scale or lift, number count-ups (`animated-counter`), skeleton→content swaps, sidebar width.

**`prefers-reduced-motion`:** `motion-reduce:transition-none`. Drawers and modals fall back to a 120ms opacity fade.

## 6. Interaction states

Focus is identical everywhere: `focus-visible:outline-2 outline-ring outline-offset-2`, no ring and no halo. Disabled is `opacity-60 cursor-not-allowed`, with no hover change.

| Control | Default | Hover | Active | Loading | Error |
| --- | --- | --- | --- | --- | --- |
| Primary button | `bg-foreground text-background` | `bg-foreground/90` | `bg-foreground/80` | Label stays, leading 16px `Loader2` spin, width locked, `aria-busy`, disabled | — |
| Secondary button | `bg-background border` | `bg-muted` | `bg-muted` + `border-foreground/20` | Same | — |
| Ghost / icon button | transparent | `bg-muted` | `bg-muted` + `text-foreground` | Same | — |
| Destructive button | `bg-destructive text-destructive-foreground` | `bg-destructive/90` | `bg-destructive/80` | Same | — |
| Input, textarea, select trigger | `bg-background border-input` | `border-foreground/20` | — | Trailing spinner (async validate only) | `border-destructive` + 13px message below with 14px `AlertCircle`, `aria-invalid`, `aria-describedby` |
| Checkbox | `border-input` | `border-foreground/40` | — | — | `border-destructive` |
| Checkbox checked / indeterminate | `bg-primary border-primary`, white glyph | `bg-primary/90` | — | — | — |
| Switch | track `bg-muted` + border | track `bg-muted` darker via `border-foreground/20` | — | — | — |
| Switch on | track `bg-primary` | `bg-primary/90` | — | Disabled while saving | Reverts + toast |
| Tab / segmented | `text-muted-foreground` | `text-foreground` | — | — | — |
| Tab selected | `text-foreground font-medium` + 2px `primary` underline (segmented: `bg-background border` in a `bg-muted/50` track) | | | | |
| Table row | transparent | `bg-muted` | — | Skeleton row | Inline row error under the cell |
| Table row selected | `bg-primary/5` | `bg-primary/5` | | | |
| Sortable header | `text-muted-foreground`, no icon until hover | `text-foreground` + faint sort icon | Sorted: `text-foreground` + `ArrowUp`/`ArrowDown` 14px, `aria-sort` | | |
| Nav item | `text-muted-foreground` | `bg-muted text-foreground` | Active: see 1.2 | | |
| Filter chip | `border bg-background` | `bg-muted` | Applied: `bg-muted border-foreground/20` + value + `X` | | |

**Loading model.** First load shows skeletons that match the final layout: same row height and column widths, `bg-muted` blocks, `animate-pulse` (opacity only, no shimmer). Refetching keeps data on screen with a 2px indeterminate bar under the table header, in `primary`. Spinners appear only inside buttons and inline async checks. Optimistic updates for toggles.

**Empty model.** One line saying what's missing and one action. Filtered-empty offers "Clear filters" instead of "Create".

**Error model.** Say what failed and what to do, plus a "Try again" button. Keep the filters and page chrome visible. Never a full-page takeover for a table fetch.

## 7. Microcopy

- Sentence case everywhere: "Event approvals", not "Event Approvals".
- Buttons are verb + object: "Publish event", "Approve changes", "Export CSV". Avoid "Submit" and "OK".
- Confirm dialogs name the thing and the consequence: "Delete *Qawwali Night at Frere Hall*? 214 ticket holders lose their tickets." The button repeats the verb ("Delete event").
- No exclamation marks, emoji, "Oops" or "Welcome back".
- Counts always carry a noun: "3 selected", "12 pending".

## 8. Accessibility baseline

AA contrast (see 01 §4). Everything is reachable by Tab in visual order. The table supports arrow-key row focus, Space to select and Enter to open. Drawers and modals trap focus and return it on close. Icon-only buttons have `aria-label`. Status isn't conveyed by colour alone (dot + label). Live regions announce bulk-action results and realtime row inserts.

## Open questions

1. ~~`--destructive` fails AA.~~ **Resolved** in INSID-217: darkened to `0 72% 45%`.
2. **Tooltip.** Not added, so no new dependency. Icon-only buttons use `aria-label`. Revisit if admins ask for hover labels.
3. **Drag-and-drop** for App layout and Categories (Sprint 2): add `@dnd-kit`, or use up/down buttons. Still open.
